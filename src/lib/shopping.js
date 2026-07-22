import { supabase } from './supabase.js'

async function whoami() {
  const { data } = await supabase.auth.getUser()
  const user = data?.user
  if (!user) return null
  return user.user_metadata?.display_name ?? user.email?.split('@')[0] ?? null
}

export async function fetchList() {
  const { data, error } = await supabase
    .from('shopping_list')
    .select('id, item, inventory_id, checked, checked_by, checked_at, created_at')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

/**
 * Reconcile the list against the kitchen.
 *
 * Adds a row for anything low or out that hasn't got one, and drops rows whose
 * item is back to ok — but never drops a TICKED row, because that's someone
 * standing in a shop looking at it. Safe to run from both devices at once: the
 * unique index turns a double-insert into a no-op instead of a duplicate.
 */
export async function syncFromInventory(inventoryItems, listRows) {
  const rowByInventoryId = new Map(
    listRows.filter((r) => r.inventory_id).map((r) => [r.inventory_id, r])
  )

  const needed = inventoryItems.filter((i) => i.status !== 'ok')
  const missing = needed.filter((i) => !rowByInventoryId.has(i.id))

  if (missing.length > 0) {
    // Plain inserts, one per item, rather than an upsert: the unique index is
    // PARTIAL (only rows with an inventory_id), and ON CONFLICT can't infer a
    // partial index without repeating its predicate — which PostgREST's
    // on_conflict, being column names only, has no way to express.
    //
    // One request per row on purpose: a batch aborts entirely if any single row
    // conflicts, which would drop the other items until the next pass.
    const results = await Promise.all(
      missing.map((i) =>
        supabase.from('shopping_list').insert({ item: i.item, inventory_id: i.id })
      )
    )
    // 23505 = the other device won the race and inserted it first. That's the
    // index doing its job, not a failure.
    const failure = results.find((r) => r.error && r.error.code !== '23505')
    if (failure) throw failure.error
  }

  const neededIds = new Set(needed.map((i) => i.id))
  const stale = listRows.filter(
    (r) => r.inventory_id && !neededIds.has(r.inventory_id) && !r.checked
  )
  if (stale.length > 0) {
    const { error } = await supabase
      .from('shopping_list')
      .delete()
      .in('id', stale.map((r) => r.id))
    if (error) throw error
  }

  return missing.length + stale.length // how much actually changed
}

export async function setChecked(id, checked) {
  const { error } = await supabase
    .from('shopping_list')
    .update({
      checked,
      checked_by: checked ? await whoami() : null,
      checked_at: checked ? new Date().toISOString() : null,
    })
    .eq('id', id)
  if (error) throw error
}

export async function addAdHoc(item) {
  const { data, error } = await supabase
    .from('shopping_list')
    .insert({ item: item.trim(), inventory_id: null })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function removeRow(id) {
  const { error } = await supabase.from('shopping_list').delete().eq('id', id)
  if (error) throw error
}

/**
 * End of the trip: everything ticked is now in the cupboard, so its inventory
 * item goes back to ok and the row leaves the list. Ad-hoc rows just leave.
 */
export async function finishTrip(listRows) {
  const checked = listRows.filter((r) => r.checked)
  if (checked.length === 0) return 0

  const inventoryIds = checked.map((r) => r.inventory_id).filter(Boolean)
  if (inventoryIds.length > 0) {
    const { error } = await supabase
      .from('inventory')
      .update({ status: 'ok', updated_at: new Date().toISOString(), updated_by: await whoami() })
      .in('id', inventoryIds)
    if (error) throw error
  }

  const { error: delError } = await supabase
    .from('shopping_list')
    .delete()
    .in('id', checked.map((r) => r.id))
  if (delError) throw delError

  return checked.length
}

/** Plain-text list for email or clipboard. */
export function listAsText(rows) {
  const outstanding = rows.filter((r) => !r.checked)
  if (outstanding.length === 0) return 'Nothing on the list.'
  return outstanding.map((r) => `- ${r.item}`).join('\n')
}

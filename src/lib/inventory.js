import { supabase } from './supabase.js'

export const STATUSES = [
  { value: 'ok', label: 'OK' },
  { value: 'low', label: 'Low' },
  { value: 'out', label: 'Out' },
]

/** Attention first: out, then low, then ok — alphabetical inside each band. */
const RANK = { out: 0, low: 1, ok: 2 }
export function sortItems(items) {
  return [...items].sort(
    (a, b) => RANK[a.status] - RANK[b.status] || a.item.localeCompare(b.item)
  )
}

/**
 * Optional display label for who touched an item last. Prefers a display name
 * from user metadata so it can read "Ashlee" rather than an email fragment.
 */
async function whoami() {
  const { data } = await supabase.auth.getUser()
  const user = data?.user
  if (!user) return null
  return user.user_metadata?.display_name ?? user.email?.split('@')[0] ?? null
}

export async function fetchInventory() {
  const { data, error } = await supabase
    .from('inventory')
    .select('id, item, status, qty_loose, updated_at, updated_by')
  if (error) throw error
  return sortItems(data ?? [])
}

export async function setStatus(id, status) {
  const { error } = await supabase
    .from('inventory')
    .update({ status, updated_at: new Date().toISOString(), updated_by: await whoami() })
    .eq('id', id)
  if (error) throw error
}

export async function addItem(item, status = 'ok') {
  const { data, error } = await supabase
    .from('inventory')
    .insert({ item: item.trim(), status, updated_by: await whoami() })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateItem(id, { item, status, qty_loose }) {
  const patch = { updated_at: new Date().toISOString(), updated_by: await whoami() }
  if (item !== undefined) patch.item = item.trim()
  if (status !== undefined) patch.status = status
  // '' clears the loose qty back to null — it must never become a required field
  if (qty_loose !== undefined) patch.qty_loose = qty_loose?.trim() ? qty_loose.trim() : null

  const { error } = await supabase.from('inventory').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteItem(id) {
  const { error } = await supabase.from('inventory').delete().eq('id', id)
  if (error) throw error
}

/**
 * "Just restocked" — everything low or out goes back to ok in one write.
 * The post-grocery-run shortcut: one tap instead of fifteen, then fix exceptions.
 */
export async function restockAll() {
  const { error } = await supabase
    .from('inventory')
    .update({ status: 'ok', updated_at: new Date().toISOString(), updated_by: await whoami() })
    .in('status', ['low', 'out'])
  if (error) throw error
}

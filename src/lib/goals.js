import { supabase } from './supabase.js'

export const GOAL_TYPES = [
  { value: 'savings', label: 'Save toward' },
  { value: 'debt_payoff', label: 'Pay off' },
]

/**
 * Goals with computed progress, plus which accounts each one watches.
 *
 * `goal_progress` is a view and carries no account list, so the M2M rows come
 * alongside and get stitched in by goal id.
 */
export async function fetchGoals() {
  const [progressRes, linksRes] = await Promise.all([
    supabase
      .from('goal_progress')
      .select('id, name, type, target, starting_amount, linked_balance, progress'),
    supabase.from('goal_accounts').select('goal_id, account_id'),
  ])
  if (progressRes.error) throw progressRes.error
  if (linksRes.error) throw linksRes.error

  const accountsByGoal = new Map()
  for (const l of linksRes.data ?? []) {
    if (!accountsByGoal.has(l.goal_id)) accountsByGoal.set(l.goal_id, [])
    accountsByGoal.get(l.goal_id).push(l.account_id)
  }

  return (progressRes.data ?? []).map((g) => ({
    ...g,
    target: Number(g.target),
    starting_amount: g.starting_amount === null ? null : Number(g.starting_amount),
    linked_balance: Number(g.linked_balance),
    progress: g.progress === null ? null : Number(g.progress),
    account_ids: accountsByGoal.get(g.id) ?? [],
  }))
}

export async function saveGoal({ id, name, type, target, starting_amount, account_ids }) {
  const row = { name: name.trim(), type, target, starting_amount }

  let goalId = id
  if (id) {
    const { error } = await supabase.from('goals').update(row).eq('id', id)
    if (error) throw error
  } else {
    const { data, error } = await supabase.from('goals').insert(row).select('id').single()
    if (error) throw error
    goalId = data.id
  }

  // Replace the link set wholesale — simpler than diffing, and the table is tiny.
  const { error: delError } = await supabase
    .from('goal_accounts')
    .delete()
    .eq('goal_id', goalId)
  if (delError) throw delError

  if (account_ids.length > 0) {
    const { error: insError } = await supabase
      .from('goal_accounts')
      .insert(account_ids.map((account_id) => ({ goal_id: goalId, account_id })))
    if (insError) throw insError
  }
  return goalId
}

export async function deleteGoal(id) {
  const { error } = await supabase.from('goals').delete().eq('id', id)
  if (error) throw error
}

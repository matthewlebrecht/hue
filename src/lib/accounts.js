import { supabase } from './supabase.js'

export const ACCOUNT_TYPES = [
  { value: 'checking', label: 'Checking', kind: 'asset' },
  { value: 'savings', label: 'Savings', kind: 'asset' },
  { value: 'credit_card', label: 'Credit card', kind: 'liability' },
  { value: 'loan', label: 'Loan', kind: 'liability' },
]

export const isLiability = (type) => type === 'credit_card' || type === 'loan'

export const typeLabel = (type) =>
  ACCOUNT_TYPES.find((t) => t.value === type)?.label ?? type

/**
 * Accounts joined to their computed balance.
 *
 * `account_balances` is a view, so it has no FK relationship PostgREST can embed —
 * two queries merged by id is the honest way to do it. Postgres `numeric` arrives
 * over the wire as a STRING, so every money field is coerced here, once, rather
 * than leaving string/number landmines for arithmetic downstream.
 */
export async function fetchAccounts() {
  const [accountsRes, balancesRes] = await Promise.all([
    supabase
      .from('accounts')
      .select('id, name, type, starting_balance, created_at')
      .order('created_at', { ascending: true }),
    supabase.from('account_balances').select('id, current_balance'),
  ])

  if (accountsRes.error) throw accountsRes.error
  if (balancesRes.error) throw balancesRes.error

  const balanceById = new Map(
    (balancesRes.data ?? []).map((b) => [b.id, Number(b.current_balance)])
  )

  return (accountsRes.data ?? []).map((a) => ({
    ...a,
    starting_balance: Number(a.starting_balance),
    // fall back to starting balance if the view somehow lags the insert
    current_balance: balanceById.get(a.id) ?? Number(a.starting_balance),
  }))
}

export async function createAccount({ name, type, starting_balance }) {
  const { data, error } = await supabase
    .from('accounts')
    .insert({ name: name.trim(), type, starting_balance })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateAccount(id, { name, type, starting_balance }) {
  const { data, error } = await supabase
    .from('accounts')
    .update({ name: name.trim(), type, starting_balance })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/** Cascades to that account's transactions — the caller must confirm first. */
export async function deleteAccount(id) {
  const { error } = await supabase.from('accounts').delete().eq('id', id)
  if (error) throw error
}

/** How many transactions a delete would take with it. */
export async function countTransactions(accountId) {
  const { count, error } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .or(`account_id.eq.${accountId},to_account_id.eq.${accountId}`)
  if (error) throw error
  return count ?? 0
}

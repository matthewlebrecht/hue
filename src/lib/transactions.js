import { supabase } from './supabase.js'

export const TXN_KINDS = [
  { value: 'spend', label: 'Spend' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'balance_adjustment', label: 'Adjust' },
]

export const kindLabel = (k) => TXN_KINDS.find((t) => t.value === k)?.label ?? k

/**
 * Recent transactions, newest first.
 *
 * Deliberately NOT using PostgREST embeds: `transactions` has two foreign keys to
 * `accounts` (account_id and to_account_id), which makes an embed ambiguous and
 * forces a fragile constraint-name hint. Account and category names are resolved
 * client-side from lists we already hold.
 */
export async function fetchTransactions({ limit = 400 } = {}) {
  const { data, error } = await supabase
    .from('transactions')
    .select(
      'id, txn_date, kind, amount, account_id, to_account_id, category_id, description, source, created_at'
    )
    .order('txn_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []).map((t) => ({ ...t, amount: Number(t.amount) }))
}

export async function createTransaction(txn) {
  const { data, error } = await supabase.from('transactions').insert(txn).select().single()
  if (error) throw error
  return data
}

export async function deleteTransaction(id) {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw error
}

/**
 * Signed effect of a transaction on ONE account's balance — mirrors the
 * `account_balances` view so the UI can explain a number the DB computed.
 */
export function effectOn(txn, accountId) {
  if (txn.account_id === accountId) {
    switch (txn.kind) {
      case 'spend':
        return -txn.amount
      case 'income':
        return txn.amount
      case 'transfer':
        return -txn.amount
      case 'balance_adjustment':
        return txn.amount
      default:
        return 0
    }
  }
  if (txn.to_account_id === accountId && txn.kind === 'transfer') return txn.amount
  return 0
}

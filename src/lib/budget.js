import { supabase } from './supabase.js'

/** First day of the current month as YYYY-MM-DD, in LOCAL time. */
export function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

/** [start, endExclusive) for a month key — the range a month's spend falls in. */
export function monthRange(monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  const end = new Date(y, m, 1) // JS months are 0-based, so this is the 1st of next month
  return {
    start: monthKey,
    endExclusive: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-01`,
  }
}

export function monthLabel(monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export async function fetchBudget(monthKey) {
  const { data, error } = await supabase
    .from('budget')
    .select('id, category_id, monthly_limit, month')
    .eq('month', monthKey)
  if (error) throw error
  return (data ?? []).map((b) => ({ ...b, monthly_limit: Number(b.monthly_limit) }))
}

/**
 * Spend per category for a month.
 *
 * Only `kind = 'spend'` counts. Transfers are excluded by definition — a card
 * payment is money moving between accounts we own, not household spending, and
 * counting it would double-count the original purchase.
 */
export async function fetchMonthSpend(monthKey) {
  const { start, endExclusive } = monthRange(monthKey)
  const { data, error } = await supabase
    .from('transactions')
    .select('amount, category_id')
    .eq('kind', 'spend')
    .gte('txn_date', start)
    .lt('txn_date', endExclusive)
  if (error) throw error

  const byCategory = new Map()
  let total = 0
  for (const t of data ?? []) {
    const amt = Number(t.amount)
    total += amt
    const key = t.category_id ?? 'uncategorised'
    byCategory.set(key, (byCategory.get(key) ?? 0) + amt)
  }
  return { byCategory, total }
}

export async function setBudget(categoryId, monthKey, monthlyLimit) {
  const { error } = await supabase
    .from('budget')
    .upsert(
      { category_id: categoryId, month: monthKey, monthly_limit: monthlyLimit },
      { onConflict: 'category_id,month' }
    )
  if (error) throw error
}

export async function clearBudget(categoryId, monthKey) {
  const { error } = await supabase
    .from('budget')
    .delete()
    .eq('category_id', categoryId)
    .eq('month', monthKey)
  if (error) throw error
}

/** Household monthly net income, from the salary_config-backed view. */
export async function fetchMonthlyIncome() {
  const { data, error } = await supabase.from('monthly_income').select('monthly_net').single()
  if (error) throw error
  return Number(data?.monthly_net ?? 0)
}

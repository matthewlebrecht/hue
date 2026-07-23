import { supabase } from './supabase.js'

/** Plain date column — parse as local or it lands a day early. */
export function dueDate(bill) {
  const [y, m, d] = bill.due_date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export async function fetchBills() {
  const { data, error } = await supabase
    .from('bills')
    .select('id, name, amount, due_date, autopay, recurrence, paid_on, ext_uid')
    .order('due_date', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createBill({ name, amount, due_date, autopay, recurrence }) {
  const { error } = await supabase.from('bills').insert({
    name: name.trim(),
    amount: amount === '' || amount == null ? null : Number(amount),
    due_date,
    autopay: Boolean(autopay),
    recurrence: recurrence || 'monthly',
  })
  if (error) throw error
}

export async function deleteBill(id) {
  const { error } = await supabase.from('bills').delete().eq('id', id)
  if (error) throw error
}

/**
 * Mark paid. A recurring bill rolls forward to the next period instead of
 * disappearing — a monthly bill isn't "done", it's due again next month, and
 * having to re-enter rent twelve times a year is how a list stops being used.
 */
export async function markPaid(bill) {
  const today = new Date()
  const iso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  if (bill.recurrence === 'once') {
    const { error } = await supabase.from('bills').update({ paid_on: iso(today) }).eq('id', bill.id)
    if (error) throw error
    return
  }

  const next = dueDate(bill)
  if (bill.recurrence === 'yearly') next.setFullYear(next.getFullYear() + 1)
  else next.setMonth(next.getMonth() + 1)

  const { error } = await supabase
    .from('bills')
    .update({ due_date: iso(next), paid_on: null })
    .eq('id', bill.id)
  if (error) throw error
}

/** Unpaid, and not so far past due it's clearly stale. */
export function isOutstanding(bill) {
  if (bill.recurrence === 'once' && bill.paid_on) return false
  const cutoff = new Date()
  cutoff.setHours(0, 0, 0, 0)
  cutoff.setDate(cutoff.getDate() - 14)
  return dueDate(bill) >= cutoff
}

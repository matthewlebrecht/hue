import { supabase } from './supabase.js'

/**
 * Deliveries. Gmail fills this table in a later phase; until then it's
 * hand-entered, which is enough to make the horizon real — the surface, sort
 * order, and ambient flag all work now and the pipe just starts populating rows.
 */
export async function fetchPackages() {
  const { data, error } = await supabase
    .from('packages')
    .select('id, carrier, tracking_no, status, eta, description, created_at')
    .order('eta', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data ?? []
}

export async function createPackage({ description, carrier, eta, tracking_no }) {
  const { data, error } = await supabase
    .from('packages')
    .insert({
      description: description?.trim() || null,
      carrier: carrier?.trim() || null,
      eta: eta || null,
      tracking_no: tracking_no?.trim() || null,
      status: 'expected',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deletePackage(id) {
  const { error } = await supabase.from('packages').delete().eq('id', id)
  if (error) throw error
}

export async function markDelivered(id) {
  const { error } = await supabase.from('packages').update({ status: 'delivered' }).eq('id', id)
  if (error) throw error
}

/** A package still worth showing: not yet delivered, and not long past its ETA. */
export function isPending(p) {
  if (p.status === 'delivered') return false
  if (!p.eta) return true
  const eta = etaDate(p)
  const cutoff = new Date()
  cutoff.setHours(0, 0, 0, 0)
  cutoff.setDate(cutoff.getDate() - 3) // a few days' grace for late deliveries
  return eta >= cutoff
}

/** ETA is a plain date column — parse as local, or it lands a day early. */
export function etaDate(p) {
  if (!p.eta) return null
  const [y, m, d] = p.eta.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function packageLabel(p) {
  return p.description?.trim() || p.carrier?.trim() || 'Package'
}

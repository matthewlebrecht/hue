import { supabase } from './supabase.js'

export async function fetchFlights() {
  const { data, error } = await supabase
    .from('flights')
    .select('id, airline, flight_no, origin, destination, depart_at, arrive_at, confirmation, who, ext_uid')
    .order('depart_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createFlight(flight) {
  const { error } = await supabase.from('flights').insert({
    airline: flight.airline?.trim() || null,
    flight_no: flight.flight_no?.trim() || null,
    origin: flight.origin?.trim()?.toUpperCase() || null,
    destination: flight.destination?.trim()?.toUpperCase() || null,
    depart_at: flight.depart_at,
    confirmation: flight.confirmation?.trim() || null,
    who: flight.who?.trim() || null,
  })
  if (error) throw error
}

export async function deleteFlight(id) {
  const { error } = await supabase.from('flights').delete().eq('id', id)
  if (error) throw error
}

/** Still ahead, with a few hours' grace so a flight doesn't vanish mid-air. */
export function isUpcoming(flight) {
  return new Date(flight.depart_at).getTime() > Date.now() - 6 * 3600 * 1000
}

export function flightLabel(f) {
  const route = [f.origin, f.destination].filter(Boolean).join(' → ')
  const code = [f.airline, f.flight_no].filter(Boolean).join(' ')
  return route || code || 'Flight'
}

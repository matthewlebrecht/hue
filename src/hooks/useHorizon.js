import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { fetchPackages, isPending, etaDate } from '../lib/packages.js'
import { fetchBills, isOutstanding, dueDate } from '../lib/bills.js'
import { fetchFlights, isUpcoming } from '../lib/flights.js'

/** Packages, bills and flights — the three things Coming Up tracks. */
export function useHorizon() {
  const [packages, setPackages] = useState([])
  const [bills, setBills] = useState([])
  const [flights, setFlights] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const [p, b, f] = await Promise.all([fetchPackages(), fetchBills(), fetchFlights()])
      setPackages(p)
      setBills(b)
      setFlights(f)
      setError(null)
    } catch (e) {
      setError(e.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const channel = supabase
      .channel('hue-horizon')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'packages' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bills' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flights' }, refresh)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [refresh])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const arrivingToday = packages.filter(isPending).filter((p) => {
    const eta = etaDate(p)
    return eta && eta.getTime() === today.getTime()
  })

  const dueSoon = bills
    .filter(isOutstanding)
    .filter((b) => !b.autopay && (dueDate(b) - today) / 86400000 <= 2)

  const nextFlight = flights.filter(isUpcoming)[0] ?? null

  return {
    packages,
    bills,
    flights,
    sources: { packages, bills, flights },
    arrivingToday,
    dueSoon,
    nextFlight,
    loading,
    error,
    refresh,
    setError,
  }
}

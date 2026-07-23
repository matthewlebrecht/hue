import { useEffect, useState } from 'react'
import { fetchTransit, nextConnections } from '../lib/commute.js'

/**
 * The timetable is static data — fetched once, then the next-connection maths
 * re-runs on a ticker. No point re-querying Supabase every minute for rows that
 * change weekly.
 */
export function useCommute() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    fetchTransit()
      .then((d) => {
        if (!alive) return
        setData(d)
        setError(d.trips.length === 0 ? 'No timetable loaded — run transit-refresh.' : null)
      })
      .catch((e) => alive && setError(e.message ?? String(e)))
      .finally(() => alive && setLoading(false))

    const timer = setInterval(() => setTick((t) => t + 1), 30000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  const connections = data ? nextConnections(new Date(), data, 4) : []

  return { connections, lastRefresh: data?.lastRefresh, loading, error, tick }
}

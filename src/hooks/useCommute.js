import { useCallback, useEffect, useState } from 'react'
import { fetchTransit, nextConnections, arrivalPlan } from '../lib/commute.js'
import { getSetting, setSetting, DEFAULT_COMMUTE } from '../lib/settings.js'
import { supabase } from '../lib/supabase.js'

/**
 * The timetable is static data — fetched once, then the next-connection maths
 * re-runs on a ticker. No point re-querying Supabase every minute for rows that
 * change weekly.
 */
export function useCommute() {
  const [data, setData] = useState(null)
  const [config, setConfig] = useState(DEFAULT_COMMUTE)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  const loadConfig = useCallback(() => {
    getSetting('commute', DEFAULT_COMMUTE)
      .then((c) => setConfig(c ?? DEFAULT_COMMUTE))
      .catch(() => setConfig(DEFAULT_COMMUTE)) // settings table not created yet
  }, [])

  useEffect(() => {
    let alive = true
    fetchTransit()
      .then((d) => {
        if (!alive) return
        setData(d)
        setError(d.trips.length === 0 ? 'No timetable loaded — tap Refresh timetable.' : null)
      })
      .catch((e) => alive && setError(e.message ?? String(e)))
      .finally(() => alive && setLoading(false))

    loadConfig()

    // a phone changing the arrival time should move the iPad's nudge
    const channel = supabase
      .channel('hue-settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hue_settings' }, loadConfig)
      .subscribe()

    const timer = setInterval(() => setTick((t) => t + 1), 30000)
    return () => {
      alive = false
      clearInterval(timer)
      supabase.removeChannel(channel)
    }
  }, [loadConfig])

  const now = new Date()
  const connections = data ? nextConnections(now, data, 4) : []

  const riders = (config?.riders ?? []).filter((r) => r.enabled)
  const plans = data
    ? riders.map((rider) => ({
        rider,
        plan: arrivalPlan(now, data, {
          arriveBy: rider.arrive_by,
          destination: rider.destination,
        }),
      }))
    : []

  const saveConfig = async (next) => {
    setConfig(next) // optimistic — the sheet closes on save
    await setSetting('commute', next)
  }

  return {
    connections,
    plans,
    config,
    saveConfig,
    lastRefresh: data?.lastRefresh,
    loading,
    error,
    tick,
  }
}

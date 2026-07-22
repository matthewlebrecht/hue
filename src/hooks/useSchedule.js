import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

/**
 * Upcoming calendar events. The `schedule` table is a read-only mirror that the
 * .ics feed fills in v3 — until then this correctly returns nothing, and the UI
 * says so rather than inventing an event.
 */
export function useSchedule({ limit = 5 } = {}) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from('schedule')
      .select('id, title, starts_at, ends_at, who, location')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .limit(limit)
    setEvents(data ?? [])
    setLoading(false)
  }, [limit])

  useEffect(() => {
    refresh()
    const channel = supabase
      .channel('hue-schedule')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule' }, refresh)
      .subscribe()
    // events fall out of "upcoming" as time passes, so re-poll on the quarter hour
    const timer = setInterval(refresh, 15 * 60 * 1000)
    return () => {
      supabase.removeChannel(channel)
      clearInterval(timer)
    }
  }, [refresh])

  return { events, next: events[0] ?? null, loading }
}

export function eventTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

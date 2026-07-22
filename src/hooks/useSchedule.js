import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

/**
 * Upcoming calendar events, mirrored from .ics feeds by the calendar-sync
 * function.
 *
 * The window starts at midnight rather than "now", and matches on ends_at as
 * well as starts_at — otherwise a trip that began yesterday vanishes while
 * you're still on it, and today's earlier events disappear by lunchtime.
 */
export function useSchedule({ limit = 60 } = {}) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const iso = start.toISOString()

    const { data } = await supabase
      .from('schedule')
      .select('id, title, starts_at, ends_at, all_day, who, location')
      .or(`ends_at.gte.${iso},starts_at.gte.${iso}`)
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
    // events roll out of the window as the day passes, and the day itself rolls over
    const timer = setInterval(refresh, 15 * 60 * 1000)
    return () => {
      supabase.removeChannel(channel)
      clearInterval(timer)
    }
  }, [refresh])

  return { events, next: events[0] ?? null, loading, refresh }
}

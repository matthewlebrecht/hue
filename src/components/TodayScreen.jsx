import { useState } from 'react'
import { useSchedule, eventTime } from '../hooks/useSchedule.js'
import { supabase } from '../lib/supabase.js'
import { sentenceCase } from '../lib/text.js'

/** "Today" / "Tomorrow" / "Wed, Jul 23" for a Date. */
function dayLabel(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((d - today) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/** All-day events come through as exact midnight-to-midnight spans. */
function isAllDay(e) {
  const s = new Date(e.starts_at)
  if (s.getHours() || s.getMinutes()) return false
  if (!e.ends_at) return true
  const len = new Date(e.ends_at) - s
  return len % 86400000 === 0 && len > 0
}

export default function TodayScreen() {
  const { events, loading, refresh } = useSchedule({ limit: 60 })
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState(null)
  const [note, setNote] = useState(null)

  async function sync() {
    setSyncing(true)
    setError(null)
    setNote(null)
    try {
      const { data, error } = await supabase.functions.invoke('calendar-sync')
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      setNote(`${data.synced} event${data.synced === 1 ? '' : 's'} synced`)
      if (data.problems?.length) setError(data.problems.join(' · '))
      await refresh()
    } catch (e) {
      setError(e.message ?? String(e))
    } finally {
      setSyncing(false)
    }
  }

  const groups = []
  for (const e of events) {
    const label = dayLabel(e.starts_at)
    if (groups.at(-1)?.label !== label) groups.push({ label, items: [] })
    groups.at(-1).items.push(e)
  }

  return (
    <div className="screen">
      <div className="screen__head">
        <div className="screen__title">Today</div>
        <button className="btn" onClick={sync} disabled={syncing}>
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}
      {note && !error && (
        <div className="field__hint" style={{ marginBottom: 16 }}>
          {note}
        </div>
      )}

      {!loading && events.length === 0 && (
        <div className="empty">
          <p>
            Nothing on the calendar. If this looks wrong, tap Sync now — HUE mirrors published
            calendar feeds and only holds the next few weeks.
          </p>
        </div>
      )}

      {groups.map((g) => (
        <div key={g.label}>
          <div className="section-label">{g.label}</div>
          <div className="txn-group">
            {g.items.map((e) => (
              <div key={e.id} className="event">
                <div className="event__when">
                  {isAllDay(e) ? 'All day' : eventTime(e.starts_at)}
                </div>
                <div className="event__main">
                  <div className="event__title">{sentenceCase(e.title)}</div>
                  {(e.location || e.who) && (
                    <div className="event__meta">
                      {[e.who, e.location].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

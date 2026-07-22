import { useState } from 'react'
import { useSchedule } from '../hooks/useSchedule.js'
import { supabase } from '../lib/supabase.js'
import { sentenceCase } from '../lib/text.js'
import { groupByDay, timeLabel, rangeLabel } from '../lib/schedule.js'

export default function TodayScreen() {
  const { events, loading, refresh } = useSchedule({ limit: 200 })
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

  const days = groupByDay(events, { days: 30 })

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

      {!loading && days.length === 0 && (
        <div className="empty">
          <p>
            Nothing on the calendar. If this looks wrong, tap Sync now — HUE mirrors published
            calendar feeds and only holds the next few weeks.
          </p>
        </div>
      )}

      {days.map((group) => (
        <div key={group.label}>
          <div className="section-label">{group.label}</div>
          <div className="txn-group">
            {group.items.map(({ event, dayIndex, dayCount }) => (
              <div
                key={`${event.id}-${dayIndex}`}
                className={`event ${dayCount > 1 ? 'event--span' : ''}`}
              >
                <div className="event__when">{timeLabel(event)}</div>
                <div className="event__main">
                  <div className="event__title">{sentenceCase(event.title)}</div>
                  {(event.location || event.who || dayCount > 1) && (
                    <div className="event__meta">
                      {[
                        // "Day 2 of 4" is the thing you actually want mid-trip
                        dayCount > 1 ? `Day ${dayIndex} of ${dayCount} · ${rangeLabel(event)}` : null,
                        event.who,
                        event.location,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
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

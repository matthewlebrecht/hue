import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useCommute } from '../hooks/useCommute.js'
import { clock, WALK_MIN, BUFFER_MIN, TRANSFER_MIN } from '../lib/commute.js'

/**
 * The commute nudge. The big number is LEAVE BY, not the train time — the train
 * time is information, the leave-by time is the decision.
 */
export default function CommuteScreen() {
  const { connections, lastRefresh, loading, error } = useCommute()
  const [next, ...later] = connections
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState(null)

  async function refreshTimetable() {
    setRefreshing(true)
    setRefreshError(null)
    try {
      const { data, error } = await supabase.functions.invoke('transit-refresh')
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      window.location.reload() // simplest way to re-read a timetable that changes weekly
    } catch (e) {
      setRefreshError(e.message ?? String(e))
      setRefreshing(false)
    }
  }

  return (
    <div className="screen">
      <div className="screen__head">
        <div className="screen__title">Commute</div>
        <button className="btn btn--small" onClick={refreshTimetable} disabled={refreshing}>
          {refreshing ? 'Pulling GTFS…' : 'Refresh timetable'}
        </button>
      </div>

      {(error || refreshError) && <div className="form-error">{refreshError || error}</div>}

      {!loading && !next && !error && !refreshError && (
        <div className="empty">
          <p>No more connections today.</p>
        </div>
      )}

      {next && (
        <>
          <div className="card leaveby">
            <div className="leaveby__label">Leave by</div>
            <div
              className="leaveby__time"
              style={{ color: next.minutesUntilLeave <= 5 ? 'var(--rose)' : 'var(--amber)' }}
            >
              {clock(next.leaveBy)}
            </div>
            <div className="leaveby__sub">
              {next.minutesUntilLeave <= 0
                ? 'Go now'
                : `in ${next.minutesUntilLeave} min · ${WALK_MIN} min walk`}
            </div>
          </div>

          <div className="section-label">Door to desk</div>
          <div className="card legs">
            <Leg
              time={clock(next.slineDepart)}
              title="S-Line from 300 East"
              meta={`Arrives Central Pointe ${clock(next.centralPointe)}`}
            />
            <Leg
              time={`${Math.round(next.wait / 60)} min`}
              title="Transfer at Central Pointe"
              meta={
                next.wait / 60 < TRANSFER_MIN + 1
                  ? 'Tight connection'
                  : 'Comfortable connection'
              }
              tone={next.wait / 60 < TRANSFER_MIN + 1 ? 'warn' : 'ok'}
            />
            <Leg
              time={clock(next.traxDepart)}
              title={`${next.traxName} Line`}
              meta={`Gallivan Plaza ${clock(next.gallivan)}${
                next.cityCenter ? ` · City Center ${clock(next.cityCenter)}` : ''
              }`}
            />
          </div>

          <div className="field__hint" style={{ marginTop: 12 }}>
            Leave-by protects the transfer, not just the first train — it's the connection that
            has to hold. Includes a {BUFFER_MIN} min buffer.
          </div>
        </>
      )}

      {later.length > 0 && (
        <>
          <div className="section-label">After that</div>
          <div className="txn-group">
            {later.map((c) => (
              <div key={c.slineDepart} className="event">
                <div className="event__when">{clock(c.leaveBy)}</div>
                <div className="event__main">
                  <div className="event__title">
                    S-Line {clock(c.slineDepart)} → {c.traxName} {clock(c.traxDepart)}
                  </div>
                  <div className="event__meta">
                    Gallivan {clock(c.gallivan)}
                    {c.cityCenter ? ` · City Center ${clock(c.cityCenter)}` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {lastRefresh && (
        <div className="field__hint" style={{ textAlign: 'center', marginTop: 20 }}>
          Timetable from {new Date(lastRefresh).toLocaleDateString()} · scheduled times only,
          live delays not wired yet
        </div>
      )}
    </div>
  )
}

function Leg({ time, title, meta, tone }) {
  return (
    <div className="leg">
      <div className={`leg__time ${tone ? `leg__time--${tone}` : ''}`}>{time}</div>
      <div>
        <div className="leg__title">{title}</div>
        <div className="leg__meta">{meta}</div>
      </div>
    </div>
  )
}

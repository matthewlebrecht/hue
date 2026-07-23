import { useSchedule } from '../hooks/useSchedule.js'
import { comingUp, timeLabel, isMultiDay, spanDays } from '../lib/schedule.js'
import { sentenceCase } from '../lib/text.js'

/**
 * The horizon view: trips and anything else worth knowing about before it's
 * today. Package tracking joins this screen when the Gmail pipe lands — it's the
 * same question ("what's arriving and when"), just a different source.
 */
export default function UpcomingScreen() {
  const { events, loading } = useSchedule({ limit: 200 })
  const items = comingUp(events, { limit: 20, days: 60 })

  return (
    <div className="screen">
      <div className="screen__head">
        <div className="screen__title">Coming up</div>
      </div>

      {!loading && items.length === 0 && (
        <div className="empty">
          <p>Nothing on the horizon in the next couple of months.</p>
        </div>
      )}

      {items.length > 0 && (
        <div className="txn-group">
          {items.map(({ event, when, daysAway }) => (
            <div
              key={event.id}
              className={`event ${isMultiDay(event) ? 'event--span' : ''}`}
            >
              <div className="event__when event__when--wide">{when}</div>
              <div className="event__main">
                <div className="event__title">{sentenceCase(event.title)}</div>
                <div className="event__meta">
                  {[
                    daysAway === 1 ? 'Tomorrow' : `In ${daysAway} days`,
                    isMultiDay(event) ? `${spanDays(event)} days` : null,
                    !event.all_day ? timeLabel(event) : null,
                    event.who,
                    event.location,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="section-label" style={{ marginTop: 32 }}>
        Packages
      </div>
      <div className="card" style={{ color: 'var(--text-faint)', fontSize: 14, lineHeight: 1.6 }}>
        Delivery tracking parsed out of Gmail lands here — carrier, status, ETA, and a quiet
        "arriving today" line on the ambient screen. Needs the Gmail pipe scoped to a label,
        never the whole inbox.
      </div>
    </div>
  )
}

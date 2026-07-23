import { useClock, timeParts } from '../hooks/useClock.js'
import { useSchedule } from '../hooks/useSchedule.js'
import { upcoming, timeLabel, shortDay, startDay } from '../lib/schedule.js'
import { useInventory } from '../hooks/useInventory.js'
import { useHorizon } from '../hooks/useHorizon.js'
import { useCommute } from '../hooks/useCommute.js'
import { clock, inCommuteWindow } from '../lib/commute.js'
import { useMoney } from '../state/MoneyContext.jsx'
import { useWeather } from '../hooks/useWeather.js'
import { describe, advice, PLACE } from '../lib/weather.js'

/**
 * Level 1 — resting state. Glanceable from across the kitchen.
 *
 * Deliberately holds ONE money signal and no numbers: a dot. Real figures are a
 * tap away. Weather and the commute pill land in v3 with their feeds; nothing
 * fake stands in for them, because a wrong temperature on the counter is worse
 * than no temperature.
 */
export default function AmbientScreen({ onWake }) {
  const now = useClock()
  const { time, meridiem, date } = timeParts(now)
  const { status, loading } = useMoney()
  const { events } = useSchedule({ limit: 20 })
  const next = upcoming(events, 1)[0] ?? null
  const { lowOrOut } = useInventory()
  const { weather } = useWeather()
  const { arrivingToday, dueSoon } = useHorizon()
  const { connections, plans } = useCommute()
  const hint = advice(weather)
  // the ambient screen only nags about the commute when it's actually relevant,
  // and prefers the train that hits someone's arrival target over the next one
  const planned = plans.find((p) => p.plan.actionable && !p.plan.missed)
  const commute = inCommuteWindow()
    ? (planned?.plan.actionable ?? connections[0] ?? null)
    : null

  return (
    <button className="ambient" onClick={onWake} aria-label="Open dashboard">
      <div className="ambient__clock">
        {time}
        <span className="ambient__meridiem">{meridiem}</span>
      </div>
      <div className="ambient__date">{date}</div>

      <div className="ambient__row">
        {weather && (
          <>
            <span className="ambient__wx">
              <span className="ambient__wx-icon">{describe(weather.code, weather.isDay).icon}</span>
              {weather.temp}°
            </span>
            <span className="ambient__place">{PLACE}</span>
            <span className="ambient__sep">·</span>
          </>
        )}
        {!loading && <span className={`dot dot--${status.tone}`} />}
      </div>

      {/* one quiet line, only when there's something to say */}
      {(next || lowOrOut.length > 0 || arrivingToday.length > 0 || dueSoon.length > 0) && (
        <div className="ambient__next">
          {[
            next &&
              (next.ongoing
                ? next.event.title
                : `Next: ${next.event.title} ${
                    next.isToday ? timeLabel(next.event) : shortDay(startDay(next.event))
                  }`),
            arrivingToday.length > 0 &&
              `📦 ${arrivingToday.length} arriving${
                arrivingToday.length === 1 ? '' : ' today'
              }`,
            dueSoon.length > 0 &&
              `💳 ${dueSoon[0].name} due${dueSoon.length > 1 ? ` +${dueSoon.length - 1}` : ''}`,
            lowOrOut.length > 0 && `${lowOrOut.length} to pick up`,
          ]
            .filter(Boolean)
            .join('  ·  ')}
        </div>
      )}

      {/* commute pill — weekday mornings only, and only while a train is catchable */}
      {commute && (
        <div className={`ambient__pill ${commute.minutesUntilLeave <= 5 ? 'ambient__pill--urgent' : ''}`}>
          Leave by {clock(commute.leaveBy)} for the {clock(commute.slineDepart)}
        </div>
      )}

      {/* the "bring a jacket" line — absent unless the weather warrants it */}
      {hint && <div className="ambient__hint">{hint}</div>}
    </button>
  )
}

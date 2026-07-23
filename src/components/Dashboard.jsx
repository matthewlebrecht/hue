import { useClock, timeParts } from '../hooks/useClock.js'
import { useSchedule } from '../hooks/useSchedule.js'
import { upcoming, timeLabel, shortDay, startDay } from '../lib/schedule.js'
import { usePackages } from '../hooks/usePackages.js'
import { horizonSummary } from '../lib/horizon.js'
import { useWeather } from '../hooks/useWeather.js'
import { describe, advice } from '../lib/weather.js'
import { cachedBriefing } from '../lib/briefing.js'
import { useInventory } from '../hooks/useInventory.js'
import { cachedIdeas } from '../lib/meals.js'
import { sentenceCase } from '../lib/text.js'
import { useMoney } from '../state/MoneyContext.jsx'
import { usd } from '../lib/format.js'

/**
 * Level 2 — the zones. Every zone is a tap target into a detail screen; the ones
 * whose feeds arrive in v2/v3 say what they're waiting for instead of faking data.
 */
export default function Dashboard({ onOpen, onRest }) {
  const now = useClock()
  const { time, meridiem, date } = timeParts(now)
  const { status, goals, spend } = useMoney()
  const { events } = useSchedule({ limit: 60 })
  const { lowOrOut } = useInventory()
  const { packages } = usePackages()
  const { weather } = useWeather()

  const agenda = upcoming(events, 3)
  const horizon = horizonSummary(events, packages, 3)
  const hint = advice(weather)
  // read-only: the dashboard shows today's briefing if one exists, never writes one
  const briefing = cachedBriefing()
  // read-only: the headline is whatever the Kitchen screen last generated, so the
  // dashboard never triggers a paid call of its own
  const meals = cachedIdeas()

  const out = lowOrOut.filter((i) => i.status === 'out')
  const low = lowOrOut.filter((i) => i.status === 'low')
  const topGoal = goals.find((g) => g.progress !== null) ?? goals[0] ?? null

  return (
    <div className="dash">
      <div className="dash__bar">
        <button className="dash__brand" onClick={onRest}>
          HUE
        </button>
        <div className="dash__clock">
          {weather && (
            <span className="dash__wx" title={describe(weather.code, weather.isDay).label}>
              {describe(weather.code, weather.isDay).icon} {weather.temp}°
              <span className="dash__wx-range">
                {weather.high}°/{weather.low}°
              </span>
            </span>
          )}
          {time}
          <span className="dash__meridiem">{meridiem}</span>
          <span className="dash__date">{date}</span>
        </div>
      </div>

      <div className="zones">
        <Zone title="Today" onClick={() => onOpen('today')}>
          {agenda.length === 0 ? (
            <Waiting>Nothing scheduled — tap to sync the calendar</Waiting>
          ) : (
            agenda.map(({ event, ongoing, isToday }) => (
              <div key={event.id} className="zone__line">
                <span className="zone__time">
                  {/* today needs no date; anything else does, or Friday reads as now */}
                  {ongoing ? 'Now' : isToday ? timeLabel(event) : shortDay(startDay(event))}
                </span>
                {sentenceCase(event.title)}
                {!isToday && !ongoing && !event.all_day && (
                  <span className="zone__sub"> {timeLabel(event)}</span>
                )}
              </div>
            ))
          )}
          {hint && <div className="zone__line zone__sub zone__hint">{hint}</div>}
        </Zone>

        <Zone
          title="Kitchen"
          onClick={() => onOpen('kitchen')}
          dot={lowOrOut.length === 0 ? 'ok' : out.length > 0 ? 'bad' : 'warn'}
        >
          {meals?.headline && (
            <div className="zone__line zone__line--lead">{sentenceCase(meals.headline)}</div>
          )}
          {lowOrOut.length === 0 ? (
            !meals?.headline && <div className="zone__line zone__line--lead">Stocked</div>
          ) : (
            <>
              {out.length > 0 && (
                <div className="zone__line">
                  <span style={{ color: 'var(--rose)' }}>Out:</span>{' '}
                  {out.map((i) => sentenceCase(i.item)).join(', ')}
                </div>
              )}
              {low.length > 0 && (
                <div className="zone__line">
                  <span style={{ color: 'var(--amber)' }}>Low:</span>{' '}
                  {low.map((i) => sentenceCase(i.item)).join(', ')}
                </div>
              )}
            </>
          )}
        </Zone>

        <Zone title="Money" onClick={() => onOpen('money')} dot={status.tone}>
          <div className="zone__line zone__line--lead">{status.line}</div>
          <div className="zone__line zone__sub">{usd(spend.total)} spent this month</div>
          {topGoal && (
            <div className="zone__line zone__sub">
              {topGoal.name}
              {topGoal.progress !== null
                ? ` ${Math.round(Math.max(0, Math.min(1, topGoal.progress)) * 100)}%`
                : ''}
            </div>
          )}
        </Zone>

        <Zone title="Coming up" onClick={() => onOpen('upcoming')}>
          {horizon.length === 0 ? (
            <Waiting>Nothing on the horizon</Waiting>
          ) : (
            horizon.map((item) => (
              <div key={item.key} className="zone__line">
                <span className="zone__time">{item.when}</span>
                {item.kind === 'package' && '📦 '}
                {sentenceCase(item.title)}
              </div>
            ))
          )}
        </Zone>

        <Zone title="Briefing" wide onClick={() => onOpen('briefing')}>
          {briefing ? (
            <div className="zone__briefing">{briefing.text}</div>
          ) : (
            <Waiting>Tap for this morning's briefing</Waiting>
          )}
        </Zone>
      </div>
    </div>
  )
}

function Zone({ title, children, onClick, dot, wide }) {
  return (
    <button className={`zone ${wide ? 'zone--wide' : ''}`} onClick={onClick}>
      <div className="zone__head">
        <span className="zone__title">{title}</span>
        {dot && <span className={`dot dot--${dot}`} />}
      </div>
      <div className="zone__body">{children}</div>
    </button>
  )
}

const Waiting = ({ children }) => <div className="zone__waiting">{children}</div>

import { useClock, timeParts } from '../hooks/useClock.js'
import { useSchedule, eventTime } from '../hooks/useSchedule.js'
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
  const { events } = useSchedule({ limit: 3 })
  const { lowOrOut } = useInventory()
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
          {time}
          <span className="dash__meridiem">{meridiem}</span>
          <span className="dash__date">{date}</span>
        </div>
      </div>

      <div className="zones">
        <Zone title="Today" onClick={() => onOpen('today')}>
          {events.length === 0 ? (
            <Waiting>Calendar feed lands in v3</Waiting>
          ) : (
            events.map((e) => (
              <div key={e.id} className="zone__line">
                <span className="zone__time">{eventTime(e.starts_at)}</span> {e.title}
              </div>
            ))
          )}
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

        <Zone title="Packages" onClick={() => onOpen('packages')}>
          <Waiting>Gmail delivery tracking arrives in v3</Waiting>
        </Zone>

        <Zone title="Briefing" wide onClick={() => onOpen('briefing')}>
          <Waiting>
            The morning briefing needs the calendar, weather and kitchen feeds first — v3
          </Waiting>
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

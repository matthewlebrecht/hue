import { useState } from 'react'
import { useSchedule } from '../hooks/useSchedule.js'
import { useWeather } from '../hooks/useWeather.js'
import { useInventory } from '../hooks/useInventory.js'
import { useMoney } from '../state/MoneyContext.jsx'
import { buildContext, fetchBriefing, cachedBriefing } from '../lib/briefing.js'

/**
 * The morning briefing. Generated on request rather than on a timer — it costs a
 * token spend per call, and an always-on display would otherwise regenerate it
 * every time the screen woke.
 */
export default function BriefingScreen() {
  const { events } = useSchedule({ limit: 100 })
  const { weather } = useWeather()
  const { items: inventory } = useInventory()
  const money = useMoney()

  const [briefing, setBriefing] = useState(cachedBriefing)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const context = buildContext({ events, weather, inventory, money })
      setBriefing(await fetchBriefing(context))
    } catch (e) {
      setError(e.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }

  const time = briefing
    ? new Date(briefing.fetched_at).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    : null

  return (
    <div className="screen">
      <div className="screen__head">
        <div className="screen__title">Briefing</div>
        <button className="btn" onClick={generate} disabled={loading}>
          {loading ? 'Writing…' : briefing ? 'Rewrite' : 'Write it'}
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}

      {briefing ? (
        <>
          <div className="card briefing">{briefing.text}</div>
          <div className="field__hint" style={{ textAlign: 'center', marginTop: 12 }}>
            Written at {time}, from today's calendar, weather, kitchen and money.
          </div>
        </>
      ) : (
        !loading && (
          <div className="card" style={{ color: 'var(--text-faint)', fontSize: 15, lineHeight: 1.6 }}>
            One paragraph pulling together today's schedule, the weather, what's low in the
            kitchen and where the money stands. Written fresh each morning — tap to generate
            today's.
          </div>
        )
      )}
    </div>
  )
}

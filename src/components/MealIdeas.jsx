import { useState } from 'react'
import { fetchMealIdeas, cachedIdeas, ageLabel } from '../lib/meals.js'

/**
 * Meal ideas from what's on hand. Deliberately NOT auto-fetched on mount — this
 * is the one feature that costs tokens per call, and an always-on kitchen iPad
 * would otherwise bill the household every time someone walked past and tapped.
 */
export default function MealIdeas() {
  const [result, setResult] = useState(cachedIdeas)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      setResult(await fetchMealIdeas())
    } catch (e) {
      setError(e.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="section-head">
        <div className="section-label" style={{ margin: 0 }}>
          Dinner ideas
          {result?.fetched_at && (
            <span style={{ textTransform: 'none', letterSpacing: 0, marginLeft: 8 }}>
              · {ageLabel(result.fetched_at)}
            </span>
          )}
        </div>
        <button className="btn btn--small" onClick={generate} disabled={loading}>
          {loading ? 'Thinking…' : result ? 'Refresh' : 'What can we make?'}
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}

      {!result && !loading && !error && (
        <div className="card" style={{ color: 'var(--text-faint)', fontSize: 14 }}>
          Ask and HUE reads the kitchen, then suggests two or three dinners built around what's
          already here.
        </div>
      )}

      {result?.ideas?.length === 0 && (
        <div className="card" style={{ color: 'var(--text-faint)', fontSize: 14 }}>
          {result.headline}
        </div>
      )}

      {result?.ideas?.map((idea) => (
        <div className="card meal" key={idea.name}>
          <div className="meal__name">{idea.name}</div>
          <div className="meal__note">{idea.note}</div>
          <div className="meal__tags">
            {idea.have?.map((h) => (
              <span className="tag tag--have" key={`h-${h}`}>
                {h}
              </span>
            ))}
            {idea.grab?.map((g) => (
              <span className="tag tag--grab" key={`g-${g}`}>
                grab {g}
              </span>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

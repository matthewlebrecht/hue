import { useState } from 'react'
import { setBudget, clearBudget, monthLabel } from '../lib/budget.js'
import { usd } from '../lib/format.js'

export default function BudgetSection({ monthKey, categories, budget, spend, onChanged }) {
  const [editing, setEditing] = useState(false)

  const limitByCategory = new Map(budget.map((b) => [b.category_id, b.monthly_limit]))

  // Show a category if it has a limit or saw spend this month — not all nine, every month.
  const rows = categories
    .map((c) => ({
      ...c,
      limit: limitByCategory.get(c.id) ?? null,
      spent: spend.byCategory.get(c.id) ?? 0,
    }))
    .filter((r) => r.limit !== null || r.spent > 0)
    .sort((a, b) => b.spent - a.spent)

  const uncategorised = spend.byCategory.get('uncategorised') ?? 0
  const totalLimit = budget.reduce((s, b) => s + b.monthly_limit, 0)
  const overTotal = totalLimit > 0 && spend.total > totalLimit

  return (
    <>
      <div className="section-head">
        <div className="section-label" style={{ margin: 0 }}>
          Spending · {monthLabel(monthKey)}
        </div>
        <button className="btn btn--ghost btn--small" onClick={() => setEditing(true)}>
          Set limits
        </button>
      </div>

      <div className="card">
        <div className="budget-total">
          <span style={{ color: overTotal ? 'var(--rose)' : 'var(--text)' }}>
            {usd(spend.total)} spent
          </span>
          {totalLimit > 0 && (
            <span style={{ color: 'var(--text-faint)' }}>
              {overTotal ? (
                <span style={{ color: 'var(--rose)' }}>
                  {usd(spend.total - totalLimit)} over {usd(totalLimit)}
                </span>
              ) : (
                `of ${usd(totalLimit)} budgeted`
              )}
            </span>
          )}
        </div>

        {rows.length === 0 && (
          <div style={{ color: 'var(--text-faint)', fontSize: 14 }}>
            No spending yet this month.
          </div>
        )}

        {rows.map((r) => (
          <BudgetRow key={r.id} row={r} />
        ))}

        {uncategorised > 0 && (
          <BudgetRow
            row={{ id: 'unc', name: 'Uncategorised', limit: null, spent: uncategorised }}
          />
        )}
      </div>

      {editing && (
        <LimitsSheet
          monthKey={monthKey}
          categories={categories}
          limitByCategory={limitByCategory}
          onClose={() => {
            setEditing(false)
            onChanged()
          }}
        />
      )}
    </>
  )
}

function BudgetRow({ row }) {
  const hasLimit = row.limit !== null && row.limit > 0
  const pct = hasLimit ? row.spent / row.limit : 0
  const tone = !hasLimit ? 'none' : pct > 1 ? 'over' : pct >= 0.9 ? 'near' : 'ok'

  return (
    <div className="bar-row">
      <div className="bar-row__head">
        <span style={tone === 'over' ? { color: 'var(--rose)' } : undefined}>{row.name}</span>
        <span className={`bar-row__figure bar-row__figure--${tone}`}>
          {usd(row.spent)}
          {hasLimit && <span className="bar-row__of"> / {usd(row.limit)}</span>}
        </span>
      </div>
      <div className="bar">
        {/* No limit set means there is nothing to be over — show a thin trace, not a
            full bar, which would read as "maxed out" when it means "untracked". */}
        <div
          className={`bar__fill bar__fill--${tone}`}
          style={{ width: hasLimit ? `${Math.min(100, pct * 100)}%` : '100%', opacity: hasLimit ? 1 : 0.35 }}
        />
      </div>
      <div className="bar-row__note">
        {!hasLimit ? 'no limit set' : tone === 'over' ? `${usd(row.spent - row.limit)} over` : ''}
      </div>
    </div>
  )
}

function LimitsSheet({ monthKey, categories, limitByCategory, onClose }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      categories.map((c) => [c.id, limitByCategory.has(c.id) ? String(limitByCategory.get(c.id)) : ''])
    )
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function onSave() {
    setBusy(true)
    setError(null)
    try {
      for (const c of categories) {
        const raw = values[c.id]?.trim() ?? ''
        const had = limitByCategory.has(c.id)
        if (raw === '') {
          if (had) await clearBudget(c.id, monthKey)
          continue
        }
        const n = Number(raw)
        if (Number.isNaN(n) || n < 0) throw new Error(`"${c.name}" needs a number.`)
        if (!had || limitByCategory.get(c.id) !== n) await setBudget(c.id, monthKey, n)
      }
      onClose()
    } catch (e) {
      setError(e.message ?? String(e))
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__title">Limits · {monthLabel(monthKey)}</div>
        <p className="field__hint" style={{ marginTop: -10, marginBottom: 18 }}>
          Leave a category blank for no limit. Limits are per month — next month starts fresh.
        </p>

        {categories.map((c) => (
          <div key={c.id} className="limit-row">
            <label htmlFor={`lim-${c.id}`}>{c.name}</label>
            <input
              id={`lim-${c.id}`}
              className="input"
              style={{ width: 120 }}
              value={values[c.id] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [c.id]: e.target.value }))}
              placeholder="—"
              inputMode="decimal"
            />
          </div>
        ))}

        {error && <div className="form-error" style={{ marginTop: 14 }}>{error}</div>}

        <div className="sheet__actions">
          <button className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn--primary" onClick={onSave} disabled={busy}>
            {busy ? 'Saving…' : 'Save limits'}
          </button>
        </div>
      </div>
    </div>
  )
}

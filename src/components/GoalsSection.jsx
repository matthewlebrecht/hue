import { useState } from 'react'
import { GOAL_TYPES, saveGoal, deleteGoal } from '../lib/goals.js'
import { isLiability } from '../lib/accounts.js'
import { usd } from '../lib/format.js'

export default function GoalsSection({ goals, accounts, onChanged }) {
  const [editing, setEditing] = useState(null) // goal | 'new' | null

  return (
    <>
      <div className="section-head">
        <div className="section-label" style={{ margin: 0 }}>
          Goals
        </div>
        <button className="btn btn--ghost btn--small" onClick={() => setEditing('new')}>
          + Goal
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="card" style={{ color: 'var(--text-faint)', fontSize: 14 }}>
          No goals yet. A goal watches one or more accounts — savings fill toward a target,
          debt drains toward zero.
        </div>
      ) : (
        <div className="card">
          {goals.map((g) => (
            <GoalRow key={g.id} goal={g} onEdit={() => setEditing(g)} />
          ))}
        </div>
      )}

      {editing && (
        <GoalForm
          goal={editing === 'new' ? null : editing}
          accounts={accounts}
          onClose={() => {
            setEditing(null)
            onChanged()
          }}
        />
      )}
    </>
  )
}

function GoalRow({ goal, onEdit }) {
  const pct = goal.progress === null ? null : Math.max(0, Math.min(1, goal.progress))
  const isDebt = goal.type === 'debt_payoff'
  const done = pct !== null && pct >= 1

  return (
    <button className="bar-row bar-row--tappable" onClick={onEdit}>
      <div className="bar-row__head">
        <span>{goal.name}</span>
        <span className="bar-row__figure">
          {isDebt ? (
            <span style={{ color: goal.linked_balance < 0 ? 'var(--rose)' : 'var(--green)' }}>
              {goal.linked_balance < 0 ? `${usd(Math.abs(goal.linked_balance))} left` : 'cleared'}
            </span>
          ) : (
            <>
              {usd(goal.linked_balance)}
              <span className="bar-row__of"> / {usd(goal.target)}</span>
            </>
          )}
        </span>
      </div>
      <div className="bar">
        <div
          className={`bar__fill bar__fill--${done ? 'done' : 'goal'}`}
          style={{ width: `${pct === null ? 0 : pct * 100}%` }}
        />
      </div>
      <div className="bar-row__note">
        {pct === null
          ? isDebt
            ? 'Set the starting debt to track progress'
            : 'Set a target to track progress'
          : `${Math.round(pct * 100)}%${isDebt ? ' paid off' : ''}`}
      </div>
    </button>
  )
}

function GoalForm({ goal, accounts, onClose }) {
  const editing = Boolean(goal)
  const [name, setName] = useState(goal?.name ?? '')
  const [type, setType] = useState(goal?.type ?? 'savings')
  const [accountIds, setAccountIds] = useState(goal?.account_ids ?? [])
  const [target, setTarget] = useState(goal ? String(goal.target) : '')
  const [startAmount, setStartAmount] = useState(() => {
    if (!goal || goal.starting_amount === null) return ''
    return String(Math.abs(goal.starting_amount))
  })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const isDebt = type === 'debt_payoff'
  const linkedBalance = accounts
    .filter((a) => accountIds.includes(a.id))
    .reduce((s, a) => s + a.current_balance, 0)

  function toggleAccount(id) {
    setAccountIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return setError('Name the goal.')
    if (accountIds.length === 0) return setError('Pick at least one account to watch.')

    let targetValue
    let starting
    if (isDebt) {
      // Target is always zero for a payoff; starting_amount is the debt at goal start,
      // stored negative so the view's (balance - start) / (0 - start) reads correctly.
      targetValue = 0
      const raw = startAmount.trim()
      const n = raw === '' ? Math.abs(linkedBalance) : Number(raw)
      if (Number.isNaN(n) || n <= 0) return setError('Enter the debt you started with.')
      starting = -Math.abs(n)
    } else {
      const n = Number(target)
      if (target.trim() === '' || Number.isNaN(n) || n <= 0)
        return setError('Enter a target amount.')
      targetValue = n
      starting = startAmount.trim() === '' ? 0 : Number(startAmount)
      if (Number.isNaN(starting)) return setError('Starting amount must be a number.')
      if (starting >= n) return setError('Target must be above the starting amount.')
    }

    setBusy(true)
    try {
      await saveGoal({
        id: goal?.id,
        name,
        type,
        target: targetValue,
        starting_amount: starting,
        account_ids: accountIds,
      })
      onClose()
    } catch (err) {
      setError(err.message ?? String(err))
      setBusy(false)
    }
  }

  async function onDelete() {
    setBusy(true)
    try {
      await deleteGoal(goal.id)
      onClose()
    } catch (err) {
      setError(err.message ?? String(err))
      setBusy(false)
    }
  }

  if (confirmingDelete) {
    return (
      <div className="sheet-backdrop" onClick={onClose}>
        <div className="sheet" onClick={(e) => e.stopPropagation()}>
          <div className="sheet__title">Delete goal?</div>
          <p style={{ color: 'var(--text-dim)', fontSize: 15, lineHeight: 1.5 }}>
            "{goal.name}" goes away. The accounts and their balances are untouched.
          </p>
          {error && <div className="form-error">{error}</div>}
          <div className="sheet__actions">
            <button className="btn btn--ghost" onClick={() => setConfirmingDelete(false)} disabled={busy}>
              Keep
            </button>
            <button className="btn btn--danger" onClick={onDelete} disabled={busy}>
              {busy ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__title">{editing ? 'Edit goal' : 'New goal'}</div>

        <form onSubmit={onSubmit}>
          <div className="field">
            <label className="field__label" htmlFor="goal-name">
              Name
            </label>
            <input
              id="goal-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isDebt ? 'Kill card debt' : 'Emergency fund'}
              autoFocus={!editing}
            />
          </div>

          <div className="field">
            <span className="field__label">Type</span>
            <div className="seg">
              {GOAL_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={`seg__opt ${type === t.value ? 'seg__opt--on' : ''}`}
                  onClick={() => setType(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="field__label">Accounts watched</span>
            <div className="checks">
              {accounts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`check ${accountIds.includes(a.id) ? 'check--on' : ''}`}
                  onClick={() => toggleAccount(a.id)}
                >
                  <span>{a.name}</span>
                  <span style={{ color: a.current_balance < 0 ? 'var(--rose)' : 'var(--text-faint)' }}>
                    {usd(a.current_balance)}
                  </span>
                </button>
              ))}
            </div>
            {accountIds.length > 0 && (
              <div className="field__hint">
                Watching {usd(linkedBalance)} across {accountIds.length} account
                {accountIds.length === 1 ? '' : 's'}.
                {isDebt &&
                  accounts.filter((a) => accountIds.includes(a.id) && !isLiability(a.type)).length >
                    0 &&
                  ' Heads up: a payoff goal usually watches only cards and loans.'}
              </div>
            )}
          </div>

          {isDebt ? (
            <div className="field">
              <label className="field__label" htmlFor="goal-start">
                Debt when the goal started
              </label>
              <input
                id="goal-start"
                className="input"
                value={startAmount}
                onChange={(e) => setStartAmount(e.target.value)}
                placeholder={String(Math.abs(linkedBalance).toFixed(2))}
                inputMode="decimal"
              />
              <div className="field__hint">
                Entered positive. Target is zero — this is what progress is measured from, so
                paying it down fills the bar. Blank uses today's {usd(Math.abs(linkedBalance))}.
              </div>
            </div>
          ) : (
            <>
              <div className="field">
                <label className="field__label" htmlFor="goal-target">
                  Target
                </label>
                <input
                  id="goal-target"
                  className="input"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="10000"
                  inputMode="decimal"
                />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="goal-base">
                  Starting from (optional)
                </label>
                <input
                  id="goal-base"
                  className="input"
                  value={startAmount}
                  onChange={(e) => setStartAmount(e.target.value)}
                  placeholder="0"
                  inputMode="decimal"
                />
                <div className="field__hint">
                  Baseline the bar measures from. Leave blank to fill from zero.
                </div>
              </div>
            </>
          )}

          {error && <div className="form-error">{error}</div>}

          <div className="sheet__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save goal'}
            </button>
          </div>

          {editing && (
            <button
              type="button"
              className="btn btn--danger"
              style={{ width: '100%', marginTop: 10 }}
              onClick={() => setConfirmingDelete(true)}
              disabled={busy}
            >
              Delete goal
            </button>
          )}
        </form>
      </div>
    </div>
  )
}

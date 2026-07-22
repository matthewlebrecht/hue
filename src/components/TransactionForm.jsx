import { useMemo, useState } from 'react'
import { TXN_KINDS, createTransaction } from '../lib/transactions.js'
import { createCategory } from '../lib/categories.js'
import { isLiability } from '../lib/accounts.js'
import { usd } from '../lib/format.js'

/** Local YYYY-MM-DD. Plain toISOString() would roll to yesterday west of UTC. */
function todayISO() {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export default function TransactionForm({ accounts, categories, onClose }) {
  const [kind, setKind] = useState('spend')
  const [amount, setAmount] = useState('')
  const [txnDate, setTxnDate] = useState(todayISO)
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [toAccountId, setToAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [newCategory, setNewCategory] = useState(null) // null = closed, '' = open
  const [trueBalance, setTrueBalance] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const account = useMemo(
    () => accounts.find((a) => a.id === accountId),
    [accounts, accountId]
  )
  const isAdjust = kind === 'balance_adjustment'
  const isTransfer = kind === 'transfer'
  const showsCategory = kind === 'spend' || kind === 'income'

  // Recon: the user enters what the bank says, HUE derives the correction.
  const adjustDelta = useMemo(() => {
    if (!isAdjust || !account || trueBalance === '') return null
    const entered = Number(trueBalance)
    if (Number.isNaN(entered)) return null
    const truth = isLiability(account.type) ? -Math.abs(entered) : entered
    return Number((truth - account.current_balance).toFixed(2))
  }, [isAdjust, account, trueBalance])

  async function addCategory() {
    const name = newCategory?.trim()
    if (!name) return setNewCategory(null)
    try {
      const cat = await createCategory(name)
      setCategoryId(cat.id)
      setNewCategory(null)
    } catch (e) {
      setError(e.message ?? String(e))
    }
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!accountId) return setError('Pick an account.')

    let payload
    if (isAdjust) {
      if (adjustDelta === null) return setError("Enter what the bank actually says.")
      if (adjustDelta === 0) return setError('Already matches — no adjustment needed.')
      payload = {
        txn_date: txnDate,
        kind,
        amount: adjustDelta, // signed: the only kind the schema allows negative
        account_id: accountId,
        to_account_id: null,
        category_id: null,
        description: description.trim() || 'Weekly recon',
      }
    } else {
      const parsed = Number(amount)
      if (amount === '' || Number.isNaN(parsed)) return setError('Enter an amount.')
      if (parsed <= 0) return setError('Amount must be greater than zero.')
      if (isTransfer) {
        if (!toAccountId) return setError('Pick where the money is going.')
        if (toAccountId === accountId) return setError('Pick two different accounts.')
      }
      payload = {
        txn_date: txnDate,
        kind,
        amount: parsed,
        account_id: accountId,
        to_account_id: isTransfer ? toAccountId : null,
        category_id: showsCategory && categoryId ? categoryId : null,
        description: description.trim() || null,
      }
    }

    setBusy(true)
    try {
      await createTransaction(payload)
      onClose()
    } catch (err) {
      setError(err.message ?? String(err))
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__title">Add transaction</div>

        <form onSubmit={onSubmit}>
          <div className="field">
            <span className="field__label">Kind</span>
            <div className="seg seg--4">
              {TXN_KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  className={`seg__opt ${kind === k.value ? 'seg__opt--on' : ''}`}
                  onClick={() => setKind(k.value)}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          {!isAdjust && (
            <div className="field">
              <label className="field__label" htmlFor="txn-amount">
                Amount
              </label>
              <input
                id="txn-amount"
                className="input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                autoFocus
              />
            </div>
          )}

          <div className="field">
            <label className="field__label" htmlFor="txn-account">
              {isTransfer ? 'From' : isAdjust ? 'Account' : kind === 'income' ? 'Into' : 'Paid from'}
            </label>
            <select
              id="txn-account"
              className="input"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {isTransfer && (
            <div className="field">
              <label className="field__label" htmlFor="txn-to">
                To
              </label>
              <select
                id="txn-to"
                className="input"
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
              >
                <option value="">Choose…</option>
                {accounts
                  .filter((a) => a.id !== accountId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
              <div className="field__hint">
                Paying a card is a transfer: checking goes down, the card's debt shrinks.
                Net worth doesn't move.
              </div>
            </div>
          )}

          {isAdjust && (
            <div className="field">
              <label className="field__label" htmlFor="txn-true">
                {account && isLiability(account.type)
                  ? 'What you actually owe'
                  : 'What the bank actually says'}
              </label>
              <input
                id="txn-true"
                className="input"
                value={trueBalance}
                onChange={(e) => setTrueBalance(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
              />
              <div className="field__hint">
                {account && (
                  <>
                    HUE computes {usd(account.current_balance)}.{' '}
                    {adjustDelta === null ? (
                      'Enter the real number and HUE logs the correction.'
                    ) : adjustDelta === 0 ? (
                      'Matches — nothing to correct.'
                    ) : (
                      <>
                        Correction:{' '}
                        <strong style={{ color: adjustDelta < 0 ? 'var(--rose)' : 'var(--green)' }}>
                          {adjustDelta > 0 ? '+' : ''}
                          {usd(adjustDelta)}
                        </strong>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {showsCategory && (
            <div className="field">
              <span className="field__label">Category</span>
              {newCategory === null ? (
                <>
                  <select
                    className="input"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    <option value="">Uncategorised</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    style={{ marginTop: 8, width: '100%' }}
                    onClick={() => setNewCategory('')}
                  >
                    + New category
                  </button>
                </>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="input"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Category name"
                    autoFocus
                  />
                  <button type="button" className="btn" onClick={addCategory}>
                    Add
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="field">
            <label className="field__label" htmlFor="txn-date">
              Date
            </label>
            <input
              id="txn-date"
              className="input"
              type="date"
              value={txnDate}
              onChange={(e) => setTxnDate(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="txn-desc">
              Description
            </label>
            <input
              id="txn-desc"
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="optional"
            />
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="sheet__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? 'Saving…' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

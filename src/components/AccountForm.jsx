import { useEffect, useState } from 'react'
import {
  ACCOUNT_TYPES,
  createAccount,
  updateAccount,
  deleteAccount,
  countTransactions,
  isLiability,
} from '../lib/accounts.js'

/**
 * Add / edit one account.
 *
 * Sign handling is the important bit. The DB stores liabilities NEGATIVE (a card
 * you owe $500 on is -500), but nobody thinks "negative five hundred" — they think
 * "I owe five hundred." So liabilities are entered as a POSITIVE amount owed and
 * negated on the way in, un-negated on the way out. Users never type a minus sign,
 * and net worth stays a plain sum the way the schema intends.
 */
export default function AccountForm({ account, onClose }) {
  const editing = Boolean(account)

  const [name, setName] = useState(account?.name ?? '')
  const [type, setType] = useState(account?.type ?? 'checking')
  const [amount, setAmount] = useState(() => {
    if (!account) return ''
    const v = account.starting_balance
    return String(isLiability(account.type) ? Math.abs(v) : v)
  })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [txnCount, setTxnCount] = useState(null)

  const liability = isLiability(type)

  useEffect(() => {
    if (confirmingDelete && account) {
      countTransactions(account.id)
        .then(setTxnCount)
        .catch(() => setTxnCount(null))
    }
  }, [confirmingDelete, account])

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) return setError('Give the account a name.')

    const parsed = Number(amount)
    if (amount === '' || Number.isNaN(parsed)) return setError('Enter a starting balance.')
    if (liability && parsed < 0) {
      return setError('Enter what you owe as a positive number — HUE stores it as debt.')
    }

    const starting_balance = liability ? -Math.abs(parsed) : parsed

    setBusy(true)
    try {
      if (editing) await updateAccount(account.id, { name, type, starting_balance })
      else await createAccount({ name, type, starting_balance })
      onClose()
    } catch (err) {
      setError(err.message ?? String(err))
      setBusy(false)
    }
  }

  async function onDelete() {
    setBusy(true)
    try {
      await deleteAccount(account.id)
      onClose()
    } catch (err) {
      setError(err.message ?? String(err))
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__title">{editing ? 'Edit account' : 'Add account'}</div>

        {confirmingDelete ? (
          <>
            <p style={{ color: 'var(--text-dim)', fontSize: 15, lineHeight: 1.5 }}>
              Delete <strong>{account.name}</strong>?
              {txnCount === null
                ? ''
                : txnCount > 0
                  ? ` This also deletes ${txnCount} transaction${txnCount === 1 ? '' : 's'} touching it.`
                  : ' It has no transactions.'}{' '}
              This can't be undone.
            </p>
            {error && <div className="form-error">{error}</div>}
            <div className="sheet__actions">
              <button
                className="btn btn--ghost"
                onClick={() => setConfirmingDelete(false)}
                disabled={busy}
              >
                Keep
              </button>
              <button className="btn btn--danger" onClick={onDelete} disabled={busy}>
                {busy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={onSubmit}>
            <div className="field">
              <label className="field__label" htmlFor="acct-name">
                Name
              </label>
              <input
                id="acct-name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ally checking"
                autoFocus={!editing}
              />
            </div>

            <div className="field">
              <span className="field__label">Type</span>
              <div className="seg">
                {ACCOUNT_TYPES.map((t) => (
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
              <label className="field__label" htmlFor="acct-balance">
                {liability ? 'Amount owed today' : 'Starting balance'}
              </label>
              <input
                id="acct-balance"
                className="input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                type="text"
              />
              <div className="field__hint">
                {liability
                  ? 'Enter it positive — HUE tracks debt as a negative balance, so this pulls net worth down.'
                  : 'The balance right now, when HUE starts tracking. Everything computes forward from here.'}
              </div>
            </div>

            {error && <div className="form-error">{error}</div>}

            <div className="sheet__actions">
              <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary" disabled={busy}>
                {busy ? 'Saving…' : editing ? 'Save' : 'Add account'}
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
                Delete account
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  )
}

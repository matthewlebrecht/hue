import { useState } from 'react'
import { deleteTransaction, kindLabel } from '../lib/transactions.js'
import { usd } from '../lib/format.js'

/** "Today" / "Yesterday" / "Mon, Jul 21" — dates are plain YYYY-MM-DD, parsed as local. */
function dayLabel(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((today - date) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function TransactionList({ transactions, accounts, categories }) {
  const [pending, setPending] = useState(null)
  const accountName = (id) => accounts.find((a) => a.id === id)?.name ?? '—'
  const categoryName = (id) => categories.find((c) => c.id === id)?.name

  if (transactions.length === 0) {
    return (
      <div className="empty">
        <p>No transactions yet. Add a spend, income, transfer, or a recon adjustment.</p>
      </div>
    )
  }

  const groups = []
  for (const t of transactions) {
    const label = dayLabel(t.txn_date)
    if (groups.at(-1)?.label !== label) groups.push({ label, items: [] })
    groups.at(-1).items.push(t)
  }

  return (
    <>
      {groups.map((g) => (
        <div key={g.label}>
          <div className="section-label">{g.label}</div>
          <div className="txn-group">
            {g.items.map((t) => (
              <button key={t.id} className="txn" onClick={() => setPending(t)}>
                <div className="txn__main">
                  <div className="txn__desc">
                    {t.description || categoryName(t.category_id) || kindLabel(t.kind)}
                  </div>
                  <div className="txn__meta">
                    {t.kind === 'transfer'
                      ? `${accountName(t.account_id)} → ${accountName(t.to_account_id)}`
                      : accountName(t.account_id)}
                    {categoryName(t.category_id) ? ` · ${categoryName(t.category_id)}` : ''}
                    {t.kind === 'balance_adjustment' ? ' · recon' : ''}
                  </div>
                </div>
                <div className={`txn__amount txn__amount--${amountTone(t)}`}>
                  {amountText(t)}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}

      {pending && <DeleteSheet txn={pending} onClose={() => setPending(null)} />}
    </>
  )
}

function amountTone(t) {
  if (t.kind === 'income') return 'pos'
  if (t.kind === 'spend') return 'neg'
  if (t.kind === 'balance_adjustment') return t.amount < 0 ? 'neg' : 'pos'
  return 'flat' // transfers move money without changing net worth
}

function amountText(t) {
  if (t.kind === 'income') return `+${usd(t.amount)}`
  if (t.kind === 'spend') return `-${usd(t.amount)}`
  if (t.kind === 'balance_adjustment')
    return `${t.amount > 0 ? '+' : ''}${usd(t.amount)}`
  return usd(t.amount)
}

function DeleteSheet({ txn, onClose }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function onDelete() {
    setBusy(true)
    try {
      await deleteTransaction(txn.id)
      onClose()
    } catch (e) {
      setError(e.message ?? String(e))
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__title">Delete transaction?</div>
        <p style={{ color: 'var(--text-dim)', fontSize: 15, lineHeight: 1.5 }}>
          {txn.description || kindLabel(txn.kind)} · {usd(txn.amount)}. Balances recompute
          immediately.
        </p>
        {error && <div className="form-error">{error}</div>}
        <div className="sheet__actions">
          <button className="btn btn--ghost" onClick={onClose} disabled={busy}>
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

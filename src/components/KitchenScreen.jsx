import { useState } from 'react'
import { useInventory } from '../hooks/useInventory.js'
import {
  STATUSES,
  setStatus,
  addItem,
  updateItem,
  deleteItem,
  restockAll,
} from '../lib/inventory.js'

/**
 * Kitchen inventory — the batch editor.
 *
 * Direct status buttons per item, not a cycling toggle: one tap lands on the
 * status you meant, with no overshoot. That's clutter traded for speed, which is
 * the right trade for a screen used with wet hands mid-unpacking.
 */
export default function KitchenScreen() {
  const { items, lowOrOut, loading, error, applyLocal, refresh, setError } = useInventory()
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(false)
  const [restocking, setRestocking] = useState(false)

  async function flip(item, status) {
    if (item.status === status) return
    const previous = item.status
    applyLocal(item.id, { status }) // optimistic
    try {
      await setStatus(item.id, status)
    } catch (e) {
      applyLocal(item.id, { status: previous })
      setError(e.message ?? String(e))
    }
  }

  async function doRestock() {
    setRestocking(true)
    try {
      await restockAll()
      await refresh()
    } catch (e) {
      setError(e.message ?? String(e))
    } finally {
      setRestocking(false)
    }
  }

  return (
    <div className="screen">
      <div className="screen__head">
        <div className="screen__title">Kitchen</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn"
            onClick={doRestock}
            disabled={restocking || lowOrOut.length === 0}
          >
            {restocking ? 'Restocking…' : 'Just restocked'}
          </button>
          <button className="btn btn--primary" onClick={() => setAdding(true)}>
            + Item
          </button>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="kitchen-summary card">
        {lowOrOut.length === 0 ? (
          <span style={{ color: 'var(--green)' }}>Everything's stocked</span>
        ) : (
          <>
            <span className="kitchen-summary__count">{lowOrOut.length}</span>
            <span>
              {' '}
              to pick up ·{' '}
              {lowOrOut
                .slice(0, 6)
                .map((i) => i.item)
                .join(', ')}
              {lowOrOut.length > 6 ? '…' : ''}
            </span>
          </>
        )}
      </div>

      {!loading && items.length === 0 && (
        <div className="empty">
          <p>Nothing tracked yet. Add the staples you actually run out of — HUE only needs
            to know ok, low, or out.</p>
          <button className="btn btn--primary" onClick={() => setAdding(true)}>
            Add the first item
          </button>
        </div>
      )}

      <div className="inv-grid">
        {items.map((i) => (
          <div key={i.id} className={`inv ${i.status !== 'ok' ? 'inv--flagged' : ''}`}>
            <button className="inv__name" onClick={() => setEditing(i)}>
              <span>{i.item}</span>
              {i.qty_loose && <span className="inv__qty">{i.qty_loose}</span>}
            </button>
            <div className="inv__statuses">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  className={`inv__status inv__status--${s.value} ${
                    i.status === s.value ? 'inv__status--on' : ''
                  }`}
                  onClick={() => flip(i, s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {adding && <AddSheet onClose={() => setAdding(false)} />}
      {editing && <ItemSheet item={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function AddSheet({ onClose }) {
  const [name, setName] = useState('')
  const [status, setStatusValue] = useState('ok')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function save(keepOpen) {
    if (!name.trim()) return setError('Name the item.')
    setBusy(true)
    setError(null)
    try {
      await addItem(name, status)
      if (keepOpen) {
        setName('') // grocery runs add several at once — stay put
        setBusy(false)
      } else {
        onClose()
      }
    } catch (e) {
      setError(e.message ?? String(e))
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__title">Add item</div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            save(true)
          }}
        >
          <div className="field">
            <label className="field__label" htmlFor="inv-name">
              Item
            </label>
            <input
              id="inv-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pickles"
              autoFocus
            />
          </div>

          <div className="field">
            <span className="field__label">Status</span>
            <div className="seg" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  className={`seg__opt ${status === s.value ? 'seg__opt--on' : ''}`}
                  onClick={() => setStatusValue(s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="sheet__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
              Done
            </button>
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? 'Adding…' : 'Add another'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ItemSheet({ item, onClose }) {
  const [name, setName] = useState(item.item)
  const [qty, setQty] = useState(item.qty_loose ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [confirming, setConfirming] = useState(false)

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await updateItem(item.id, { item: name, qty_loose: qty })
      onClose()
    } catch (e) {
      setError(e.message ?? String(e))
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await deleteItem(item.id)
      onClose()
    } catch (e) {
      setError(e.message ?? String(e))
      setBusy(false)
    }
  }

  if (confirming) {
    return (
      <div className="sheet-backdrop" onClick={onClose}>
        <div className="sheet" onClick={(e) => e.stopPropagation()}>
          <div className="sheet__title">Stop tracking {item.item}?</div>
          {error && <div className="form-error">{error}</div>}
          <div className="sheet__actions">
            <button className="btn btn--ghost" onClick={() => setConfirming(false)} disabled={busy}>
              Keep
            </button>
            <button className="btn btn--danger" onClick={remove} disabled={busy}>
              {busy ? 'Removing…' : 'Remove'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__title">{item.item}</div>

        <div className="field">
          <label className="field__label" htmlFor="inv-edit-name">
            Name
          </label>
          <input
            id="inv-edit-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="inv-qty">
            How much (optional)
          </label>
          <input
            id="inv-qty"
            className="input"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="plenty · some · half a bag"
          />
          <div className="field__hint">
            Loose and always optional — never servings or grams. It only exists to make meal
            ideas smarter. Clear it to drop it.
          </div>
        </div>

        {item.updated_by && (
          <div className="field__hint" style={{ marginBottom: 14 }}>
            Last touched by {item.updated_by}
          </div>
        )}

        {error && <div className="form-error">{error}</div>}

        <div className="sheet__actions">
          <button className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn--primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>

        <button
          className="btn btn--danger"
          style={{ width: '100%', marginTop: 10 }}
          onClick={() => setConfirming(true)}
          disabled={busy}
        >
          Remove from kitchen
        </button>
      </div>
    </div>
  )
}

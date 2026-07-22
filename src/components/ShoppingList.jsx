import { useState } from 'react'
import { useShopping } from '../hooks/useShopping.js'
import { setChecked, addAdHoc, removeRow, finishTrip, listAsText } from '../lib/shopping.js'
import { sentenceCase } from '../lib/text.js'

/**
 * The shared list. Both phones open this at the shop; ticking is live.
 *
 * Ticked items stay visible with a strikethrough rather than vanishing — you want
 * to see the trip's progress, and undo a mis-tap. "Finish trip" is what actually
 * clears them and marks the kitchen restocked.
 */
export default function ShoppingList({ inventoryItems, inventoryLoaded }) {
  const { rows, outstanding, checked, loading, error, refresh, setError } = useShopping(
    inventoryItems,
    inventoryLoaded
  )
  const [adding, setAdding] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  async function toggle(row) {
    // optimistic — a tap in a shop aisle must not wait on the network
    const next = !row.checked
    setError(null)
    try {
      await setChecked(row.id, next)
    } catch (e) {
      setError(e.message ?? String(e))
    }
  }

  async function onAdd(e) {
    e.preventDefault()
    if (!adding.trim()) return
    try {
      await addAdHoc(adding)
      setAdding('')
      await refresh()
    } catch (e) {
      setError(e.message ?? String(e))
    }
  }

  async function onFinish() {
    setBusy(true)
    try {
      await finishTrip(rows)
      await refresh()
    } catch (e) {
      setError(e.message ?? String(e))
    } finally {
      setBusy(false)
    }
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(listAsText(rows))
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('Clipboard blocked — use the email button instead.')
    }
  }

  const mailto = `mailto:?subject=${encodeURIComponent('Grocery list')}&body=${encodeURIComponent(
    listAsText(rows)
  )}`

  return (
    <>
      <form className="list-add" onSubmit={onAdd}>
        <input
          className="input"
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          placeholder="Add something to the list"
        />
        <button className="btn" type="submit" disabled={!adding.trim()}>
          Add
        </button>
      </form>

      {error && <div className="form-error">{error}</div>}

      {!loading && rows.length === 0 && (
        <div className="empty">
          <p>
            Nothing to buy. Anything you mark low or out in the kitchen shows up here
            automatically.
          </p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="card" style={{ padding: 8 }}>
          {[...outstanding, ...checked].map((row) => (
            <div key={row.id} className="list-row">
              <button
                className={`list-check ${row.checked ? 'list-check--on' : ''}`}
                onClick={() => toggle(row)}
                aria-label={row.checked ? `Untick ${row.item}` : `Tick ${row.item}`}
              >
                {row.checked ? '✓' : ''}
              </button>
              <button className="list-item" onClick={() => toggle(row)}>
                <span className={row.checked ? 'list-item--done' : ''}>
                  {sentenceCase(row.item)}
                </span>
                {row.checked && row.checked_by && (
                  <span className="list-by">{row.checked_by}</span>
                )}
                {!row.inventory_id && <span className="list-by">added</span>}
              </button>
              <button
                className="list-remove"
                onClick={() => removeRow(row.id).catch((e) => setError(e.message))}
                aria-label={`Remove ${row.item}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <div className="list-actions">
          <button className="btn btn--ghost btn--small" onClick={onCopy}>
            {copied ? 'Copied' : 'Copy list'}
          </button>
          <a className="btn btn--ghost btn--small" href={mailto}>
            Email list
          </a>
          <button
            className="btn btn--primary btn--small"
            onClick={onFinish}
            disabled={busy || checked.length === 0}
          >
            {busy ? 'Finishing…' : `Finish trip (${checked.length})`}
          </button>
        </div>
      )}

      {checked.length > 0 && (
        <div className="field__hint" style={{ textAlign: 'center', marginTop: 12 }}>
          Finishing marks those {checked.length} item{checked.length === 1 ? '' : 's'} back to OK
          in the kitchen and clears them off the list.
        </div>
      )}
    </>
  )
}

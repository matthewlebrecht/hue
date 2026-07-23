import { useState } from 'react'
import { useSchedule } from '../hooks/useSchedule.js'
import { usePackages } from '../hooks/usePackages.js'
import { horizonItems } from '../lib/horizon.js'
import { createPackage, deletePackage, markDelivered } from '../lib/packages.js'
import { sentenceCase } from '../lib/text.js'

/**
 * The horizon: calendar and deliveries on one timeline. Gmail will fill the
 * package side automatically later; hand entry keeps the surface real until then.
 */
export default function UpcomingScreen() {
  const { events, loading: eventsLoading } = useSchedule({ limit: 200 })
  const { packages, loading: pkgLoading, error, refresh, setError } = usePackages()
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState(null)

  const items = horizonItems(events, packages, { days: 60, limit: 30 })
  const loading = eventsLoading || pkgLoading

  return (
    <div className="screen">
      <div className="screen__head">
        <div className="screen__title">Coming up</div>
        <button className="btn" onClick={() => setAdding(true)}>
          + Package
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}

      {!loading && items.length === 0 && (
        <div className="empty">
          <p>Nothing on the horizon — no trips, no deliveries.</p>
        </div>
      )}

      {items.length > 0 && (
        <div className="txn-group">
          {items.map((item) => (
            <div
              key={item.key}
              className={`event ${item.spanning ? 'event--span' : ''} ${
                item.kind === 'package' ? 'event--package' : ''
              }`}
              onClick={item.kind === 'package' ? () => setSelected(item.raw) : undefined}
            >
              <div className="event__when event__when--wide">{item.when}</div>
              <div className="event__main">
                <div className="event__title">
                  {item.kind === 'package' && <span className="event__badge">📦</span>}
                  {sentenceCase(item.title)}
                </div>
                {item.meta.length > 0 && (
                  <div className="event__meta">{item.meta.join(' · ')}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="field__hint" style={{ marginTop: 16 }}>
        Deliveries are hand-entered for now. The Gmail pipe will add them
        automatically — same list, same sort.
      </div>

      {adding && (
        <PackageForm
          onClose={() => {
            setAdding(false)
            refresh()
          }}
        />
      )}

      {selected && (
        <PackageSheet
          pkg={selected}
          onClose={() => {
            setSelected(null)
            refresh()
          }}
          onError={setError}
        />
      )}
    </div>
  )
}

function PackageForm({ onClose }) {
  const [description, setDescription] = useState('')
  const [carrier, setCarrier] = useState('')
  const [eta, setEta] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function save(e) {
    e.preventDefault()
    if (!description.trim()) return setError('What is it?')
    setBusy(true)
    try {
      await createPackage({ description, carrier, eta })
      onClose()
    } catch (err) {
      setError(err.message ?? String(err))
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__title">Expecting a delivery</div>
        <form onSubmit={save}>
          <div className="field">
            <label className="field__label" htmlFor="pkg-desc">
              What is it
            </label>
            <input
              id="pkg-desc"
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Lawn batteries"
              autoFocus
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="pkg-carrier">
              Carrier (optional)
            </label>
            <input
              id="pkg-carrier"
              className="input"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              placeholder="Amazon"
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="pkg-eta">
              Expected (optional)
            </label>
            <input
              id="pkg-eta"
              className="input"
              type="date"
              value={eta}
              onChange={(e) => setEta(e.target.value)}
            />
            <div className="field__hint">
              Without a date it still shows, just at the bottom of the list.
            </div>
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="sheet__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PackageSheet({ pkg, onClose, onError }) {
  const [busy, setBusy] = useState(false)

  async function run(fn) {
    setBusy(true)
    try {
      await fn(pkg.id)
      onClose()
    } catch (e) {
      onError(e.message ?? String(e))
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__title">{sentenceCase(pkg.description || pkg.carrier || 'Package')}</div>
        <p style={{ color: 'var(--text-dim)', fontSize: 15, lineHeight: 1.5 }}>
          {[pkg.carrier, pkg.tracking_no, pkg.eta].filter(Boolean).join(' · ') || 'No details.'}
        </p>
        <div className="sheet__actions">
          <button className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Close
          </button>
          <button className="btn btn--primary" onClick={() => run(markDelivered)} disabled={busy}>
            It arrived
          </button>
        </div>
        <button
          className="btn btn--danger"
          style={{ width: '100%', marginTop: 10 }}
          onClick={() => run(deletePackage)}
          disabled={busy}
        >
          Remove
        </button>
      </div>
    </div>
  )
}

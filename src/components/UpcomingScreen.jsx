import { useState } from 'react'
import { useHorizon } from '../hooks/useHorizon.js'
import { horizonItems } from '../lib/horizon.js'
import { createPackage, deletePackage, markDelivered } from '../lib/packages.js'
import { createBill, deleteBill, markPaid } from '../lib/bills.js'
import { createFlight, deleteFlight } from '../lib/flights.js'
import { sentenceCase } from '../lib/text.js'

const TYPES = [
  { value: 'package', label: '📦 Package' },
  { value: 'flight', label: '✈ Flight' },
  { value: 'bill', label: '💳 Bill' },
]

/**
 * Coming Up — deliveries, flights, and bills. Not the calendar: that's the Today
 * zone's job, and duplicating it here made this screen a second copy of it.
 */
export default function UpcomingScreen() {
  const { sources, loading, error, refresh, setError } = useHorizon()
  const [adding, setAdding] = useState(null)
  const [selected, setSelected] = useState(null)

  const items = horizonItems(sources, { limit: 40, days: 90 })

  return (
    <div className="screen">
      <div className="screen__head">
        <div className="screen__title">Coming up</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {TYPES.map((t) => (
            <button key={t.value} className="btn btn--small" onClick={() => setAdding(t.value)}>
              + {t.label.split(' ')[1]}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      {!loading && items.length === 0 && (
        <div className="empty">
          <p>Nothing due, arriving, or departing.</p>
        </div>
      )}

      {items.length > 0 && (
        <div className="txn-group">
          {items.map((item) => (
            <button
              key={item.key}
              className={`event event--tap ${item.urgent ? 'event--urgent' : ''}`}
              onClick={() => setSelected(item)}
            >
              <div
                className={`event__when event__when--wide ${
                  item.overdue ? 'event__when--overdue' : ''
                }`}
              >
                {item.when}
              </div>
              <div className="event__main">
                <div className="event__title">
                  <span className="event__badge">{item.icon}</span>
                  {sentenceCase(item.title)}
                </div>
                {item.meta.length > 0 && (
                  <div className="event__meta">{item.meta.join(' · ')}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="field__hint" style={{ marginTop: 16 }}>
        Hand-entered for now. Gmail will fill flights and packages automatically — both tables
        key on the source message id, so re-parsing updates rows instead of duplicating them.
      </div>

      {adding && (
        <AddSheet
          type={adding}
          onClose={() => {
            setAdding(null)
            refresh()
          }}
        />
      )}

      {selected && (
        <ItemSheet
          item={selected}
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

function AddSheet({ type, onClose }) {
  const [form, setForm] = useState({ recurrence: 'monthly' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (type === 'package') {
        if (!form.description?.trim()) throw new Error('What is it?')
        await createPackage(form)
      } else if (type === 'bill') {
        if (!form.name?.trim()) throw new Error('Name the bill.')
        if (!form.due_date) throw new Error('When is it due?')
        await createBill(form)
      } else {
        if (!form.depart_at) throw new Error('When does it leave?')
        await createFlight(form)
      }
      onClose()
    } catch (err) {
      setError(err.message ?? String(err))
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__title">{TYPES.find((t) => t.value === type)?.label}</div>
        <form onSubmit={save}>
          {type === 'package' && (
            <>
              <Field label="What is it" value={form.description} onChange={(v) => set('description', v)} placeholder="Lawn batteries" autoFocus />
              <Field label="Carrier" value={form.carrier} onChange={(v) => set('carrier', v)} placeholder="Amazon" />
              <Field label="Expected" type="date" value={form.eta} onChange={(v) => set('eta', v)} hint="Without a date it still shows, at the bottom." />
            </>
          )}

          {type === 'bill' && (
            <>
              <Field label="Bill" value={form.name} onChange={(v) => set('name', v)} placeholder="Rent" autoFocus />
              <Field label="Amount" value={form.amount} onChange={(v) => set('amount', v)} placeholder="1450" inputMode="decimal" />
              <Field label="Due" type="date" value={form.due_date} onChange={(v) => set('due_date', v)} />
              <div className="field">
                <span className="field__label">Repeats</span>
                <div className="seg" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                  {['monthly', 'yearly', 'once'].map((r) => (
                    <button key={r} type="button" className={`seg__opt ${form.recurrence === r ? 'seg__opt--on' : ''}`} onClick={() => set('recurrence', r)}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <button type="button" className={`check ${form.autopay ? 'check--on' : ''}`} onClick={() => set('autopay', !form.autopay)}>
                  <span>Autopay</span>
                  <span>{form.autopay ? 'On' : 'Off'}</span>
                </button>
                <div className="field__hint">Autopay bills still show, but never flag as urgent.</div>
              </div>
            </>
          )}

          {type === 'flight' && (
            <>
              <div style={{ display: 'flex', gap: 10 }}>
                <Field label="From" value={form.origin} onChange={(v) => set('origin', v)} placeholder="SLC" autoFocus />
                <Field label="To" value={form.destination} onChange={(v) => set('destination', v)} placeholder="MCI" />
              </div>
              <Field label="Departs" type="datetime-local" value={form.depart_at} onChange={(v) => set('depart_at', v)} />
              <div style={{ display: 'flex', gap: 10 }}>
                <Field label="Airline" value={form.airline} onChange={(v) => set('airline', v)} placeholder="Delta" />
                <Field label="Flight" value={form.flight_no} onChange={(v) => set('flight_no', v)} placeholder="1234" />
              </div>
              <Field label="Confirmation" value={form.confirmation} onChange={(v) => set('confirmation', v)} placeholder="ABC123" />
              <Field label="Who" value={form.who} onChange={(v) => set('who', v)} placeholder="Matthew" />
            </>
          )}

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

function Field({ label, value, onChange, hint, type = 'text', ...rest }) {
  return (
    <div className="field" style={{ flex: 1 }}>
      <label className="field__label">{label}</label>
      <input
        className="input"
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
      {hint && <div className="field__hint">{hint}</div>}
    </div>
  )
}

function ItemSheet({ item, onClose, onError }) {
  const [busy, setBusy] = useState(false)

  async function run(fn) {
    setBusy(true)
    try {
      await fn()
      onClose()
    } catch (e) {
      onError(e.message ?? String(e))
      setBusy(false)
    }
  }

  const primary =
    item.kind === 'package'
      ? { label: 'It arrived', fn: () => markDelivered(item.raw.id) }
      : item.kind === 'bill'
        ? { label: 'Mark paid', fn: () => markPaid(item.raw) }
        : null

  const remove =
    item.kind === 'package'
      ? () => deletePackage(item.raw.id)
      : item.kind === 'bill'
        ? () => deleteBill(item.raw.id)
        : () => deleteFlight(item.raw.id)

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__title">
          {item.icon} {sentenceCase(item.title)}
        </div>
        <p style={{ color: 'var(--text-dim)', fontSize: 15, lineHeight: 1.5 }}>
          {[item.when, ...item.meta].filter(Boolean).join(' · ')}
        </p>
        {item.kind === 'bill' && item.raw.recurrence !== 'once' && (
          <div className="field__hint" style={{ marginBottom: 14 }}>
            Marking paid rolls it forward to next {item.raw.recurrence === 'yearly' ? 'year' : 'month'}
            {' '}rather than removing it.
          </div>
        )}
        <div className="sheet__actions">
          <button className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Close
          </button>
          {primary && (
            <button className="btn btn--primary" onClick={() => run(primary.fn)} disabled={busy}>
              {primary.label}
            </button>
          )}
        </div>
        <button
          className="btn btn--danger"
          style={{ width: '100%', marginTop: 10 }}
          onClick={() => run(remove)}
          disabled={busy}
        >
          Remove
        </button>
      </div>
    </div>
  )
}

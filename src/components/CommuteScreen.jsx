import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useCommute } from '../hooks/useCommute.js'
import { clock, arrivalAt, WALK_MIN, BUFFER_MIN, TRANSFER_MIN } from '../lib/commute.js'
import { DEFAULT_COMMUTE } from '../lib/settings.js'

const DESTINATIONS = [
  { value: 'gallivan', label: 'Gallivan Plaza', group: 'Downtown' },
  { value: 'city_center', label: 'City Center', group: 'Downtown' },
  { value: 'sugarmont', label: 'Sugarmont', group: 'Sugar House' },
  { value: 'fairmont', label: 'Fairmont', group: 'Sugar House' },
]

/**
 * The commute nudge, planned backwards from when you need to be there. The big
 * number is LEAVE BY — the train time is information, the leave-by is the
 * decision.
 */
export default function CommuteScreen() {
  const { plans, connections, outbound, config, saveConfig, live, lastRefresh, loading, error, tick } =
    useCommute()

  // recomputed on the hook's 30s tick so the countdowns actually count down
  const now = new Date()
  const nowS = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
  void tick
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState(null)
  const [editing, setEditing] = useState(false)

  async function refreshTimetable() {
    setRefreshing(true)
    setRefreshError(null)
    try {
      const { data, error } = await supabase.functions.invoke('transit-refresh')
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      window.location.reload()
    } catch (e) {
      setRefreshError(e.message ?? String(e))
      setRefreshing(false)
    }
  }

  return (
    <div className="screen">
      <div className="screen__head">
        <div className="screen__title">Commute</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--small" onClick={() => setEditing(true)}>
            Arrival times
          </button>
          <button className="btn btn--small" onClick={refreshTimetable} disabled={refreshing}>
            {refreshing ? 'Pulling GTFS…' : 'Refresh'}
          </button>
        </div>
      </div>

      {(error || refreshError) && <div className="form-error">{refreshError || error}</div>}

      {plans.length === 0 && !loading && !error && (
        <div className="empty">
          <p>No arrival times set. Add one and HUE works backwards from it.</p>
          <button className="btn btn--primary" onClick={() => setEditing(true)}>
            Set arrival time
          </button>
        </div>
      )}

      {plans.map(({ rider, plan }) => (
        <RiderPlan key={rider.id} rider={rider} plan={plan} />
      ))}

      {(connections.length > 0 || outbound.length > 0) && (
        <>
          <div className="section-label" style={{ marginTop: 32 }}>
            Departures from 300 East
          </div>

          {connections.length > 0 && (
            <>
              <div className="board-label">Towards downtown</div>
              <div className="txn-group" style={{ marginBottom: 16 }}>
                {connections.map((c) => (
                  <Departure
                    key={`in-${c.slineDepart}`}
                    departsAt={c.slineDepart}
                    nowS={nowS}
                    note={c.slineDelay ? delayText(c.slineDelay) : null}
                    stops={[
                      ['Central Pointe', c.centralPointe],
                      [`${c.traxName} Line`, c.traxDepart],
                      ['Gallivan Plaza', c.gallivan],
                      ['City Center', c.cityCenter],
                    ]}
                    warn={c.broken ? 'Connection missed — take the next one' : null}
                  />
                ))}
              </div>
            </>
          )}

          {outbound.length > 0 && (
            <>
              <div className="board-label">Towards Sugar House</div>
              <div className="txn-group">
                {outbound.map((t) => (
                  <Departure
                    key={`out-${t.tripId}`}
                    departsAt={t.at300East}
                    nowS={nowS}
                    stops={[
                      ['Sugarmont', t.sugarmont],
                      ['Fairmont', t.fairmont],
                    ]}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {live?.alerts?.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 28 }}>
            Service alerts
          </div>
          {live.alerts.slice(0, 3).map((a) => (
            <div className="card" key={a.header} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 14, color: 'var(--amber)' }}>{a.header}</div>
              {a.description && (
                <div style={{ fontSize: 13, color: 'var(--text-faint)', marginTop: 6 }}>
                  {a.description}
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {lastRefresh && (
        <div className="field__hint" style={{ textAlign: 'center', marginTop: 20 }}>
          Timetable from {new Date(lastRefresh).toLocaleDateString()} ·{' '}
          {live?.configured
            ? live.error
              ? `live feed error: ${live.error}`
              : `live · ${live.trips ?? 0} trips updated`
            : 'scheduled times (no realtime key set)'}
        </div>
      )}

      {editing && (
        <ArrivalSheet
          config={config ?? DEFAULT_COMMUTE}
          onSave={saveConfig}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  )
}

function RiderPlan({ rider, plan }) {
  const destination = DESTINATIONS.find((d) => d.value === rider.destination)?.label
  const target = plan.recommended
  const tomorrow = plan.day === 'tomorrow'
  // Tomorrow's plan can't be "missed" — nothing has departed yet.
  const late = !tomorrow && plan.missed

  if (!target) {
    return (
      <div className="card" style={{ marginBottom: 16, color: 'var(--text-faint)' }}>
        {rider.name}: nothing today gets to {destination} by {rider.arrive_by}.
      </div>
    )
  }

  // Once the latest on-time train has gone, every earlier one has too — so
  // there's no "next best" to fall back to, only "you're late".
  const showing = late ? null : (plan.actionable ?? target)

  return (
    <div style={{ marginBottom: 26 }}>
      <div className="section-head" style={{ marginTop: 0 }}>
        <div className="section-label" style={{ margin: 0 }}>
          {tomorrow ? 'Tomorrow · ' : ''}
          {rider.name} → {destination} by {clock(plan.target)}
        </div>
      </div>

      {late ? (
        <div className="card leaveby">
          <div className="leaveby__label">Too late</div>
          <div className="leaveby__time" style={{ color: 'var(--rose)', fontSize: 32 }}>
            Nothing left
          </div>
          <div className="leaveby__sub">
            Every on-time connection has gone. Check next departures below.
          </div>
        </div>
      ) : (
        <div className="card leaveby">
          <div className="leaveby__label">Leave by</div>
          <div
            className="leaveby__time"
            style={{
              color:
                !tomorrow && showing.minutesUntilLeave <= 5 ? 'var(--rose)' : 'var(--amber)',
            }}
          >
            {clock(showing.leaveBy)}
          </div>
          <div className="leaveby__sub">
            {tomorrow
              ? `tomorrow morning · arrives ${clock(arrivalAt(showing, rider.destination))}`
              : showing.minutesUntilLeave <= 0
                ? 'Go now'
                : `in ${showing.minutesUntilLeave} min · arrives ${clock(
                    arrivalAt(showing, rider.destination)
                  )}`}
          </div>
        </div>
      )}

      {showing && showing.direct && (
        <div className="card legs">
          <Leg
            time={clock(showing.slineDepart)}
            title="S-Line from 300 East"
            meta={`${showing.headsign || 'Eastbound'} · ${destination} ${clock(
              arrivalAt(showing, rider.destination)
            )}`}
          />
        </div>
      )}

      {showing && !showing.direct && (
        <div className="card legs">
          <Leg
            time={clock(showing.slineDepart)}
            title="S-Line from 300 East"
            meta={
              showing.slineDelay
                ? `${delayText(showing.slineDelay)} · Central Pointe ${clock(showing.centralPointe)}`
                : `Central Pointe ${clock(showing.centralPointe)}`
            }
            tone={showing.slineDelay > 0 ? 'warn' : undefined}
          />
          <Leg
            time={`${Math.round(showing.wait / 60)} min`}
            title="Transfer at Central Pointe"
            meta={
              showing.broken
                ? "Won't make it — take the next one"
                : showing.wait / 60 < TRANSFER_MIN + 1
                  ? 'Tight connection'
                  : 'Comfortable connection'
            }
            tone={showing.broken ? 'bad' : showing.wait / 60 < TRANSFER_MIN + 1 ? 'warn' : 'ok'}
          />
          <Leg
            time={clock(showing.traxDepart)}
            title={`${showing.traxName} Line`}
            meta={
              (showing.traxDelay ? `${delayText(showing.traxDelay)} · ` : '') +
              `${destination} ${clock(arrivalAt(showing, rider.destination))}`
            }
            tone={showing.traxDelay > 0 ? 'warn' : undefined}
          />
        </div>
      )}

      {!late && plan.backup && (
        <div className="field__hint" style={{ marginTop: 10 }}>
          Earlier option: leave {clock(plan.backup.leaveBy)}, arrives{' '}
          {clock(arrivalAt(plan.backup, rider.destination))} — {WALK_MIN} min walk plus a{' '}
          {BUFFER_MIN} min buffer is already included.
        </div>
      )}
    </div>
  )
}

/**
 * One row of the board: how long you've got, which train that is, and where it
 * puts you. The countdown leads because "13 min" is the thing you act on —
 * a clock time makes you do the subtraction yourself.
 */
function Departure({ departsAt, nowS, stops, note, warn }) {
  const mins = Math.round((departsAt - nowS) / 60)
  const urgent = mins <= 5

  return (
    <div className="departure">
      <div className="departure__head">
        <div className={`departure__count ${urgent ? 'departure__count--urgent' : ''}`}>
          <span className="departure__mins">{mins <= 0 ? 'now' : mins}</span>
          {mins > 0 && <span className="departure__unit">min</span>}
        </div>
        <div className="departure__take">Take train at {clock(departsAt)}</div>
      </div>

      <div className="departure__stops">
        {stops
          .filter(([, time]) => time != null)
          .map(([name, time]) => (
            <span key={name} className="departure__stop">
              <span className="departure__stop-name">{name}</span> {clock(time)}
            </span>
          ))}
      </div>

      {note && <div className="departure__note">{note}</div>}
      {warn && <div className="departure__note departure__note--warn">{warn}</div>}
    </div>
  )
}

/** "running 6 late" / "4 early" — minutes, in the words a person would use. */
function delayText(seconds) {
  const min = Math.round(Math.abs(seconds) / 60)
  if (min === 0) return 'on time'
  return seconds > 0 ? `running ${min} late` : `${min} early`
}

function Leg({ time, title, meta, tone }) {
  return (
    <div className="leg">
      <div className={`leg__time ${tone ? `leg__time--${tone}` : ''}`}>{time}</div>
      <div>
        <div className="leg__title">{title}</div>
        <div className="leg__meta">{meta}</div>
      </div>
    </div>
  )
}

function ArrivalSheet({ config, onSave, onClose }) {
  const [riders, setRiders] = useState(config.riders ?? DEFAULT_COMMUTE.riders)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const update = (id, patch) =>
    setRiders((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await onSave({ ...config, riders })
      onClose()
    } catch (e) {
      setError(e.message ?? String(e))
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__title">Arrival times</div>
        <p className="field__hint" style={{ marginTop: -10, marginBottom: 20 }}>
          HUE works backwards from these — the latest connection that still gets you there.
        </p>

        {riders.map((r) => (
          <div key={r.id} className="rider">
            <button
              className={`check ${r.enabled ? 'check--on' : ''}`}
              onClick={() => update(r.id, { enabled: !r.enabled })}
            >
              <span>{r.name}</span>
              <span>{r.enabled ? 'On' : 'Off'}</span>
            </button>

            {r.enabled && (
              <>
                <div className="field" style={{ marginTop: 10 }}>
                  <span className="field__label">Gets off at</span>
                  {['Downtown', 'Sugar House'].map((group) => (
                    <div key={group} style={{ marginBottom: 8 }}>
                      <div className="field__hint" style={{ margin: '0 0 6px' }}>
                        {group}
                        {group === 'Sugar House' ? ' — direct, no transfer' : ' — via Central Pointe'}
                      </div>
                      <div className="seg">
                        {DESTINATIONS.filter((d) => d.group === group).map((d) => (
                          <button
                            key={d.value}
                            type="button"
                            className={`seg__opt ${
                              r.destination === d.value ? 'seg__opt--on' : ''
                            }`}
                            onClick={() => update(r.id, { destination: d.value })}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="field">
                  <label className="field__label" htmlFor={`arr-${r.id}`}>
                    Needs to be there by
                  </label>
                  <input
                    id={`arr-${r.id}`}
                    className="input"
                    type="time"
                    value={r.arrive_by}
                    onChange={(e) => update(r.id, { arrive_by: e.target.value })}
                  />
                </div>
              </>
            )}
          </div>
        ))}

        {error && <div className="form-error">{error}</div>}

        <div className="sheet__actions">
          <button className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn--primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

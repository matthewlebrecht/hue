import { isPending, etaDate, packageLabel } from './packages.js'
import { isOutstanding, dueDate } from './bills.js'
import { isUpcoming, flightLabel } from './flights.js'
import { shortDay } from './schedule.js'
import { usd } from './format.js'

/**
 * Coming Up: what's arriving, departing, or coming due.
 *
 * Deliberately NOT the calendar. Mirroring events here made this a second Today
 * zone; these three sources answer a question the calendar doesn't — things with
 * a deadline attached that nobody put in a calendar.
 */

const DAY_MS = 86400000

const startOfToday = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

const daysAway = (date) => Math.round((date - startOfToday()) / DAY_MS)

function whenLabel(date, days) {
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days < 0) return `${Math.abs(days)}d overdue`
  return shortDay(date)
}

export function horizonItems(
  { packages = [], bills = [], flights = [] },
  { limit = 40, days = 60 } = {}
) {
  const horizon = new Date(startOfToday().getTime() + days * DAY_MS)
  const items = []

  for (const p of packages.filter(isPending)) {
    const eta = etaDate(p)
    if (eta && eta > horizon) continue
    items.push({
      key: `p-${p.id}`,
      kind: 'package',
      icon: '📦',
      date: eta,
      when: eta ? whenLabel(eta, daysAway(eta)) : 'No ETA',
      title: packageLabel(p),
      meta: [p.carrier, p.tracking_no].filter(Boolean),
      urgent: eta ? daysAway(eta) === 0 : false,
      raw: p,
    })
  }

  for (const f of flights.filter(isUpcoming)) {
    const depart = new Date(f.depart_at)
    if (depart > horizon) continue
    const day = new Date(depart.getFullYear(), depart.getMonth(), depart.getDate())
    items.push({
      key: `f-${f.id}`,
      kind: 'flight',
      icon: '✈',
      date: day,
      when: whenLabel(day, daysAway(day)),
      title: flightLabel(f),
      meta: [
        depart.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        [f.airline, f.flight_no].filter(Boolean).join(' '),
        f.confirmation,
        f.who,
      ].filter(Boolean),
      urgent: daysAway(day) <= 1,
      raw: f,
    })
  }

  for (const b of bills.filter(isOutstanding)) {
    const due = dueDate(b)
    if (due > horizon) continue
    const away = daysAway(due)
    items.push({
      key: `b-${b.id}`,
      kind: 'bill',
      icon: '💳',
      date: due,
      when: whenLabel(due, away),
      title: b.name,
      meta: [
        b.amount != null ? usd(b.amount) : null,
        b.autopay ? 'Autopay' : null,
        b.recurrence !== 'once' ? b.recurrence : null,
      ].filter(Boolean),
      // Only a bill you have to act on is urgent — autopay handles itself.
      urgent: away <= 2 && !b.autopay,
      overdue: away < 0,
      raw: b,
    })
  }

  return items
    .sort((a, b) => {
      if (!a.date && !b.date) return 0
      if (!a.date) return 1 // undated packages sink rather than look imminent
      if (!b.date) return -1
      return a.date - b.date
    })
    .slice(0, limit)
}

/** The handful of lines the dashboard zone can fit. */
export function horizonSummary(sources, limit = 3) {
  return horizonItems(sources, { limit })
}

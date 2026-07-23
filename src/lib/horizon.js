import { comingUp, startDay, isMultiDay, spanDays, rangeLabel, shortDay, timeLabel } from './schedule.js'
import { isPending, etaDate, packageLabel } from './packages.js'

/**
 * One timeline for everything on the horizon — calendar and deliveries in the
 * same list. Kept together on purpose: "what's coming" is one question, and
 * splitting it into two panels makes the reader do the merging.
 */
export function horizonItems(events, packages, { days = 60, limit = 20 } = {}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const eventItems = comingUp(events, { limit: 50, days }).map(({ event, when, daysAway }) => ({
    key: `e-${event.id}`,
    kind: 'event',
    date: startDay(event),
    when,
    title: event.title,
    spanning: isMultiDay(event),
    meta: [
      daysAway === 1 ? 'Tomorrow' : `In ${daysAway} days`,
      isMultiDay(event) ? `${spanDays(event)} days` : null,
      !event.all_day ? timeLabel(event) : null,
      event.who,
      event.location,
    ].filter(Boolean),
    raw: event,
  }))

  // Packages include TODAY — unlike calendar events, they have no Today zone
  // covering them, so dropping today's would hide the one that matters most.
  const packageItems = packages
    .filter(isPending)
    .filter((p) => {
      const eta = etaDate(p)
      return !eta || eta >= today
    })
    .map((p) => {
      const eta = etaDate(p)
      const daysAway = eta ? Math.round((eta - today) / 86400000) : null
      return {
        key: `p-${p.id}`,
        kind: 'package',
        date: eta,
        when: eta ? (daysAway === 0 ? 'Today' : shortDay(eta)) : 'No ETA',
        title: packageLabel(p),
        spanning: false,
        meta: [
          daysAway === 0 ? 'Arriving today' : daysAway === 1 ? 'Tomorrow' : null,
          p.carrier,
          p.tracking_no,
        ].filter(Boolean),
        raw: p,
      }
    })

  return [...eventItems, ...packageItems]
    .sort((a, b) => {
      // Undated packages sink to the bottom rather than pretending to be soon.
      if (!a.date && !b.date) return 0
      if (!a.date) return 1
      if (!b.date) return -1
      return a.date - b.date
    })
    .slice(0, limit)
}

/**
 * The three lines the dashboard zone can fit.
 *
 * Chronological, but the next multi-day trip is guaranteed a slot even if it's
 * further out — a trip needs lead time to be useful, and strict chronology would
 * bury it behind three deliveries the week before.
 */
export function horizonSummary(events, packages, limit = 3) {
  const all = horizonItems(events, packages, { limit: 50 })
  const picked = all.slice(0, limit)

  const nextTrip = all.find((i) => i.spanning)
  if (nextTrip && !picked.includes(nextTrip)) picked[picked.length - 1] = nextTrip

  return picked
}

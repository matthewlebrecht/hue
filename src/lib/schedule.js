/**
 * Calendar display logic.
 *
 * Two rules drive everything here:
 *
 * 1. All-day events are anchored at UTC midnight (see calendar-sync), so their
 *    dates must be read with UTC getters. Reading them locally rolls a Denver
 *    date back to 6 PM the previous day.
 * 2. iCalendar DTEND is EXCLUSIVE for date-valued events — Aug 6 -> Aug 10 runs
 *    *through Aug 9*. Every "last day" calculation subtracts one.
 */

const DAY_MS = 86400000

const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

export function today() {
  return midnight(new Date())
}

/** Calendar day an event starts on, in local terms. */
export function startDay(e) {
  const d = new Date(e.starts_at)
  return e.all_day
    ? new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    : midnight(d)
}

/** Last day the event actually covers — inclusive. */
export function endDay(e) {
  const start = startDay(e)
  if (!e.ends_at) return start
  const d = new Date(e.ends_at)

  if (e.all_day) {
    const exclusive = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    const last = new Date(exclusive.getTime() - DAY_MS)
    return last < start ? start : last
  }

  // A timed event ending at exactly midnight belongs to the previous day, not
  // the next one — "6pm to midnight" is a Tuesday event, not Tuesday-Wednesday.
  const local = midnight(d)
  if (d.getHours() === 0 && d.getMinutes() === 0 && local > start) {
    return new Date(local.getTime() - DAY_MS)
  }
  return local < start ? start : local
}

/** How many calendar days the event covers. 1 for a normal event. */
export function spanDays(e) {
  return Math.round((endDay(e) - startDay(e)) / DAY_MS) + 1
}

export const isMultiDay = (e) => spanDays(e) > 1

/** True if the event covers `day` (a local-midnight Date). */
export function coversDay(e, day) {
  return day >= startDay(e) && day <= endDay(e)
}

/** "Today" / "Tomorrow" / "Thu, Aug 6" */
export function dayLabel(day) {
  const diff = Math.round((midnight(day) - today()) / DAY_MS)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return midnight(day).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/** "Thu Aug 6" — compact prefix for a future event on a crowded surface. */
export function shortDay(day) {
  return midnight(day).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/** "6:00 PM", or "All day" when there's no meaningful time. */
export function timeLabel(e) {
  if (e.all_day) return 'All day'
  return new Date(e.starts_at).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** "Aug 6 – Aug 9" for a trip; null for a single-day event. */
export function rangeLabel(e) {
  if (!isMultiDay(e)) return null
  const fmt = { month: 'short', day: 'numeric' }
  return `${startDay(e).toLocaleDateString('en-US', fmt)} – ${endDay(e).toLocaleDateString('en-US', fmt)}`
}

/**
 * Expand events into per-day buckets, so a trip appears on every day it covers
 * rather than only the day it began. Days with nothing on them are omitted.
 *
 * All-day and multi-day items sort first within a day — a trip is context for
 * the whole day, not something that happens at a particular moment in it.
 */
export function groupByDay(events, { days = 30 } = {}) {
  const start = today()
  const buckets = []

  for (let i = 0; i < days; i++) {
    const day = new Date(start.getTime() + i * DAY_MS)
    const items = events
      .filter((e) => coversDay(e, day))
      .map((e) => ({
        event: e,
        dayIndex: Math.round((day - startDay(e)) / DAY_MS) + 1,
        dayCount: spanDays(e),
      }))
      .sort((a, b) => {
        const aFirst = a.event.all_day || a.dayCount > 1
        const bFirst = b.event.all_day || b.dayCount > 1
        if (aFirst !== bFirst) return aFirst ? -1 : 1
        return new Date(a.event.starts_at) - new Date(b.event.starts_at)
      })

    if (items.length > 0) buckets.push({ day, label: dayLabel(day), items })
  }
  return buckets
}

/**
 * Flat "what's coming up" list for the dashboard zone and ambient line — one
 * entry per event (not per day), so a four-day trip doesn't eat the whole zone.
 */
export function upcoming(events, limit = 3) {
  const start = today()
  return events
    .filter((e) => endDay(e) >= start)
    .sort((a, b) => startDay(a) - startDay(b) || new Date(a.starts_at) - new Date(b.starts_at))
    .slice(0, limit)
    .map((e) => ({
      event: e,
      ongoing: startDay(e) < start && endDay(e) >= start,
      isToday: startDay(e).getTime() === start.getTime(),
    }))
}

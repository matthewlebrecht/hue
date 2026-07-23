import { supabase } from './supabase.js'

/**
 * Commute: 300 East (S-Line) -> Central Pointe -> Blue/Green -> downtown.
 *
 * The whole point is that this is a TWO-train trip. An S-Line delay doesn't just
 * make you late, it can blow the transfer entirely — so the leave-by time is
 * computed from a connection that actually holds, not from each train alone.
 */

/** Door to the 300 East platform. */
export const WALK_MIN = Number(import.meta.env.VITE_COMMUTE_WALK_MIN ?? 2)
/** Slack so you're not running for it. */
export const BUFFER_MIN = Number(import.meta.env.VITE_COMMUTE_BUFFER_MIN ?? 2)
/** Platform-to-platform at Central Pointe. Below this the connection isn't real. */
export const TRANSFER_MIN = Number(import.meta.env.VITE_COMMUTE_TRANSFER_MIN ?? 3)
/**
 * Longest wait at Central Pointe still worth calling a connection. Without this,
 * the last S-Line of the night "connects" to the first TRAX of the morning —
 * technically true, six hours on a platform, useless as a nudge.
 */
export const MAX_WAIT_MIN = Number(import.meta.env.VITE_COMMUTE_MAX_WAIT_MIN ?? 45)

const DAY_COLS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export async function fetchTransit() {
  const [tripsRes, servicesRes, exceptionsRes, metaRes] = await Promise.all([
    supabase.from('transit_trip').select('*').order('depart_s'),
    supabase.from('transit_service').select('*'),
    supabase.from('transit_service_exception').select('*'),
    supabase.from('transit_meta').select('*').eq('key', 'last_refresh').maybeSingle(),
  ])
  if (tripsRes.error) throw tripsRes.error

  return {
    trips: tripsRes.data ?? [],
    services: servicesRes.data ?? [],
    exceptions: exceptionsRes.data ?? [],
    lastRefresh: metaRes.data?.value ?? null,
  }
}

const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * Which service patterns run on a given date. Exceptions win over the weekly
 * pattern — that's how holidays work in GTFS, and a Christmas timetable silently
 * ignored is exactly the morning you'd miss the train.
 */
export function activeServices(date, services, exceptions) {
  const key = ymd(date)
  const dayCol = DAY_COLS[date.getDay()]
  const active = new Set()

  for (const s of services) {
    if (key < s.start_date || key > s.end_date) continue
    if (s[dayCol]) active.add(s.service_id)
  }
  for (const e of exceptions) {
    if (e.exception_date !== key) continue
    if (e.added) active.add(e.service_id)
    else active.delete(e.service_id)
  }
  return active
}

const secondsInto = (d) => d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()

/**
 * Next connections that actually hold.
 *
 * GTFS times run past 24:00 for after-midnight service, so a 00:30 train is
 * "yesterday's service at 24:30". Both service days are considered or the last
 * trains of the night vanish from the board.
 */
export function nextConnections(now, { trips, services, exceptions }, count = 3) {
  const todayServices = activeServices(now, services, exceptions)
  const yesterday = new Date(now.getTime() - 86400000)
  const yesterdayServices = activeServices(yesterday, services, exceptions)

  const nowS = secondsInto(now)

  const runsAt = (trip, offset) =>
    offset === 0
      ? todayServices.has(trip.service_id)
      : yesterdayServices.has(trip.service_id) && trip.depart_s >= 86400

  const legTrips = (leg) => {
    const out = []
    for (const offset of [0, -1]) {
      for (const t of trips) {
        if (t.leg !== leg || !runsAt(t, offset)) continue
        // shift yesterday's after-midnight trips onto today's clock
        const shift = offset === -1 ? -86400 : 0
        out.push({ ...t, depart_s: t.depart_s + shift, arrive_s: t.arrive_s + shift,
          arrive_alt_s: t.arrive_alt_s == null ? null : t.arrive_alt_s + shift })
      }
    }
    return out.sort((a, b) => a.depart_s - b.depart_s)
  }

  const slines = legTrips('sline')
  const traxs = legTrips('trax')

  const results = []
  for (const s of slines) {
    // Only trains you could still physically catch.
    if (s.depart_s < nowS + WALK_MIN * 60) continue

    const connection = traxs.find(
      (t) =>
        t.depart_s >= s.arrive_s + TRANSFER_MIN * 60 &&
        t.depart_s <= s.arrive_s + MAX_WAIT_MIN * 60
    )
    if (!connection) continue

    results.push({
      leaveBy: s.depart_s - (WALK_MIN + BUFFER_MIN) * 60,
      slineTripId: s.trip_id,
      traxTripId: connection.trip_id,
      slineDepart: s.depart_s,
      centralPointe: s.arrive_s,
      wait: connection.depart_s - s.arrive_s,
      traxRoute: connection.route_short,
      traxName: connection.route_short === '701' ? 'Blue' : 'Green',
      traxDepart: connection.depart_s,
      gallivan: connection.arrive_s,
      cityCenter: connection.arrive_alt_s,
      minutesUntilLeave: Math.round((s.depart_s - (WALK_MIN + BUFFER_MIN) * 60 - nowS) / 60),
    })
    if (results.length >= count) break
  }
  return results
}

/**
 * Fold live delays into a connection.
 *
 * The important part is re-checking the transfer. A six-minute S-Line delay with
 * a three-minute connection doesn't make you six minutes late — it makes you
 * fifteen late, because you watch the TRAX leave. That's the failure the whole
 * two-train design exists to catch, so a broken connection is surfaced as
 * broken rather than quietly re-timed.
 */
export function applyLive(connection, updates) {
  if (!updates) return connection

  const slineDelay = updates[connection.slineTripId]?.['23567']?.delay ?? 0
  const slineArrDelay = updates[connection.slineTripId]?.['23565']?.delay ?? slineDelay
  const traxDelay = updates[connection.traxTripId]?.['18413']?.delay ?? 0

  if (!slineDelay && !slineArrDelay && !traxDelay) return { ...connection, live: false }

  const slineDepart = connection.slineDepart + slineDelay
  const centralPointe = connection.centralPointe + slineArrDelay
  const traxDepart = connection.traxDepart + traxDelay
  const wait = traxDepart - centralPointe

  return {
    ...connection,
    live: true,
    slineDelay,
    traxDelay,
    slineDepart,
    centralPointe,
    traxDepart,
    wait,
    gallivan: connection.gallivan + traxDelay,
    cityCenter: connection.cityCenter == null ? null : connection.cityCenter + traxDelay,
    leaveBy: slineDepart - (WALK_MIN + BUFFER_MIN) * 60,
    // Below the platform-change minimum the connection no longer holds.
    broken: wait < TRANSFER_MIN * 60,
  }
}

/** Every connection running on a given service date, ignoring the clock. */
export function connectionsOn(date, data) {
  const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0)
  return nextConnections(midnight, data, 500)
}

export const isWeekday = (d) => d.getDay() !== 0 && d.getDay() !== 6

export const arrivalAt = (connection, destination) =>
  destination === 'city_center' ? (connection.cityCenter ?? connection.gallivan) : connection.gallivan

/** "08:00" -> seconds after midnight */
export function parseHm(hm) {
  const [h, m] = String(hm).split(':').map(Number)
  return h * 3600 + (m || 0) * 60
}

/**
 * Plan backwards from when you need to be there.
 *
 * "Next train from now" is the wrong question when your start time is fixed —
 * the useful answer is the LATEST connection that still gets you there on time,
 * plus the one before it as insurance.
 */
export function arrivalPlan(date, data, { arriveBy, destination, now = null }) {
  const target = parseHm(arriveBy)

  // Planning a future day: nothing has "already gone", so the clock is ignored.
  const sameDay =
    now &&
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate()
  const nowS = sameDay ? now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds() : -Infinity

  const onTime = connectionsOn(date, data).filter((c) => {
    const arrival = arrivalAt(c, destination)
    return arrival != null && arrival <= target
  })

  if (onTime.length === 0) return { recommended: null, backup: null, missed: false, target }

  // Latest one that still makes it — anything earlier is standing around at work.
  const recommended = onTime[onTime.length - 1]
  const backup = onTime[onTime.length - 2] ?? null

  // Still catchable? The walk has to fit before the train leaves.
  const catchable = onTime.filter(
    (c) => nowS === -Infinity || c.slineDepart >= nowS + WALK_MIN * 60
  )

  // The LAST still-catchable option, not the first. Taking the first would put
  // you at your desk an hour early every morning — the whole point of an arrival
  // target is to leave as late as you safely can.
  const actionable = catchable.length > 0 ? catchable[catchable.length - 1] : null

  return {
    target,
    recommended,
    backup,
    // Every on-time option has gone — you're arriving late whatever you do.
    missed: catchable.length === 0,
    actionable,
    slack: recommended ? target - arrivalAt(recommended, destination) : null,
  }
}

/**
 * Which commute the headline should show.
 *
 * Once today's last on-time train has gone, the useful thing to see is
 * tomorrow's — but only if tomorrow is a workday. That means Friday evening
 * shows nothing (tomorrow is Saturday), Saturday shows nothing, and Sunday
 * evening shows Monday, which is exactly when you'd want it.
 */
export function commutePlan(now, data, { arriveBy, destination }) {
  if (isWeekday(now)) {
    const today = arrivalPlan(now, data, { arriveBy, destination, now })
    if (today.recommended && !today.missed) return { ...today, day: 'today' }
  }

  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  if (!isWeekday(tomorrow)) return null

  const plan = arrivalPlan(tomorrow, data, { arriveBy, destination })
  return plan.recommended ? { ...plan, day: 'tomorrow', date: tomorrow } : null
}

/**
 * The other direction: S-Line trains that reach 300 East heading east.
 *
 * Not a connection — there's no transfer to protect, it's a single train. It's
 * the ride home from Central Pointe and the ride out toward Sugar House, which
 * are the same train at the same moment.
 */
export function outboundDepartures(now, data, count = 3) {
  const todayServices = activeServices(now, data.services, data.exceptions)
  const yesterday = new Date(now.getTime() - 86400000)
  const yesterdayServices = activeServices(yesterday, data.services, data.exceptions)
  const nowS = secondsInto(now)

  const out = []
  for (const offset of [0, -1]) {
    for (const t of data.trips) {
      if (t.leg !== 'sline_out') continue
      const runs =
        offset === 0
          ? todayServices.has(t.service_id)
          : yesterdayServices.has(t.service_id) && t.depart_s >= 86400
      if (!runs) continue
      const shift = offset === -1 ? -86400 : 0
      out.push({
        tripId: t.trip_id,
        headsign: t.headsign,
        centralPointe: t.depart_s + shift,
        at300East: t.arrive_s + shift,
      })
    }
  }

  return out
    .filter((t) => t.at300East >= nowS)
    .sort((a, b) => a.at300East - b.at300East)
    .slice(0, count)
}

/** Seconds-after-midnight -> "7:44 AM". Handles values past 24h. */
export function clock(seconds) {
  if (seconds == null) return null
  const s = ((seconds % 86400) + 86400) % 86400
  const h24 = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const h = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`
}

/** Weekday mornings — when the nudge is worth surfacing unprompted. */
export function inCommuteWindow(now = new Date()) {
  const day = now.getDay()
  if (day === 0 || day === 6) return false
  const h = now.getHours()
  return h >= 6 && h < 10
}

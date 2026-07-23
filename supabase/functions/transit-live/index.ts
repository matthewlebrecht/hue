// HUE — live transit delays (GTFS-Realtime)
//
// Overlays real departure times on the static timetable so the leave-by shifts
// when a train runs late. This matters more here than on a single-train
// commute: an S-Line delay doesn't just make you late, it can blow the TRAX
// transfer at Central Pointe entirely.
//
// UTA gates its GTFS-RT feed behind a developer API key, so the endpoint is
// configuration, not a constant:
//   supabase secrets set UTA_GTFS_RT_URL="https://.../tripupdates?key=YOURKEY"
//
// Without it the function returns an empty overlay and the app falls back to
// scheduled times — degraded, never broken.
//
// Deploy:  supabase functions deploy transit-live

// Default import, not named: the package is CommonJS, so `npm:` exposes it as a
// default export and `import { transit_realtime }` fails at boot.
import GtfsRealtimeBindings from 'npm:gtfs-realtime-bindings@1.1.1'

const { transit_realtime } = GtfsRealtimeBindings

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// The stops HUE actually cares about (resolved from the static feed).
const STOP_300E = '23567'
const STOP_CP_SLINE = '23565'
const STOP_CP_TRAX = '18413'
const STOP_GALLIVAN = '18415'
const STOP_CITY_CENTER = '18385'
const NEEDED = new Set([STOP_300E, STOP_CP_SLINE, STOP_CP_TRAX, STOP_GALLIVAN, STOP_CITY_CENTER])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const url = Deno.env.get('UTA_GTFS_RT_URL')
  if (!url) {
    // Not an error: the app is expected to run on scheduled times until a key exists.
    return json({ configured: false, updates: {}, alerts: [] })
  }

  try {
    const res = await fetch(url, { headers: { Accept: 'application/x-protobuf' } })
    if (!res.ok) throw new Error(`realtime feed returned ${res.status}`)

    const buf = new Uint8Array(await res.arrayBuffer())

    // A stale key or a captive-portal page will 200 with HTML; decoding that as
    // protobuf produces garbage rather than an error, so check the shape first.
    if (buf.length > 0 && (buf[0] === 0x3c || buf[0] === 0x7b)) {
      throw new Error('realtime feed returned HTML/JSON, not protobuf — check the API key')
    }

    const feed = transit_realtime.FeedMessage.decode(buf)

    /**
     * trip_id -> { stop_id: {delay, time} }
     *
     * Keyed by trip because that's what the static table stores; the client can
     * then look up exactly the trips in the connection it's showing rather than
     * trying to match on route and time.
     */
    const updates: Record<string, Record<string, { delay: number; time: number | null }>> = {}

    for (const entity of feed.entity ?? []) {
      const tu = entity.tripUpdate
      if (!tu?.trip?.tripId) continue
      const tripId = String(tu.trip.tripId)

      for (const stu of tu.stopTimeUpdate ?? []) {
        const stopId = stu.stopId ? String(stu.stopId) : null
        if (!stopId || !NEEDED.has(stopId)) continue

        const event = stu.departure ?? stu.arrival
        // SKIPPED means the train isn't stopping — a delay of 0 would be a lie.
        const skipped =
          stu.scheduleRelationship ===
          transit_realtime.TripUpdate.StopTimeUpdate.ScheduleRelationship.SKIPPED

        const delay = skipped ? null : Number(event?.delay ?? 0)
        const time = event?.time ? Number(event.time) : null
        if (delay === null && time === null && !skipped) continue

        updates[tripId] ??= {}
        updates[tripId][stopId] = { delay: skipped ? Number.NaN : (delay ?? 0), time }
      }
    }

    const alerts = (feed.entity ?? [])
      .filter((e) => e.alert)
      .map((e) => ({
        header: e.alert?.headerText?.translation?.[0]?.text ?? null,
        description: e.alert?.descriptionText?.translation?.[0]?.text ?? null,
      }))
      .filter((a) => a.header)

    return json({
      configured: true,
      fetched_at: new Date().toISOString(),
      trips: Object.keys(updates).length,
      updates,
      alerts,
    })
  } catch (e) {
    return json({ configured: true, error: e instanceof Error ? e.message : String(e), updates: {} }, 200)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

// HUE — calendar sync
//
// Fetches published .ics feeds, expands recurring events, and mirrors the next
// few weeks into the `schedule` table. Read-only by nature: HUE never writes
// back to anyone's calendar.
//
// Config (a Supabase secret, so the feed URLs never touch git):
//   supabase secrets set CALENDAR_FEEDS="Matthew=https://...;Ashlee=https://..."
//   Entries are separated by ';' and each is Label=URL. webcal:// is rewritten
//   to https:// automatically.
//
// Deploy:
//   supabase functions deploy calendar-sync

import ICAL from 'npm:ical.js@2'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** How much of the calendar HUE mirrors. Ambient display only needs the near future. */
const DAYS_BACK = 1
const DAYS_AHEAD = 30
/** Safety valve: a daily-forever event would otherwise expand without end. */
const MAX_OCCURRENCES = 400

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const feeds = parseFeeds(Deno.env.get('CALENDAR_FEEDS') ?? '')
    if (feeds.length === 0) {
      return json({ error: 'No CALENDAR_FEEDS secret set on the function.' }, 500)
    }

    const now = new Date()
    const windowStart = new Date(now.getTime() - DAYS_BACK * 86400000)
    const windowEnd = new Date(now.getTime() + DAYS_AHEAD * 86400000)

    const rows = []
    const problems = []

    for (const feed of feeds) {
      try {
        rows.push(...(await loadFeed(feed, windowStart, windowEnd)))
      } catch (e) {
        // One broken feed shouldn't wipe the other person's calendar.
        problems.push(`${feed.label}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    if (rows.length === 0 && problems.length > 0) {
      return json({ error: problems.join(' · ') }, 502)
    }

    // Service role: this is a background mirror, and it must be able to clear out
    // events that were cancelled or moved upstream.
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Full refresh of the window rather than a diff. A cancelled event simply
    // stops appearing in the feed — there's no tombstone to react to — so
    // replacing the window is the only way stale events actually disappear.
    const { error: delError } = await admin
      .from('schedule')
      .delete()
      .eq('source', 'ics')
      .gte('starts_at', windowStart.toISOString())
    if (delError) throw delError

    if (rows.length > 0) {
      // Plain insert, not upsert: the (source, ext_uid) unique index is PARTIAL,
      // and ON CONFLICT can't infer a partial index without its predicate.
      const { error: insError } = await admin.from('schedule').insert(rows)
      if (insError) throw insError
    }

    return json({
      synced: rows.length,
      feeds: feeds.map((f) => f.label),
      window: { from: windowStart.toISOString(), to: windowEnd.toISOString() },
      problems,
    })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})

/** "Matthew=https://a;Ashlee=https://b" -> [{label, url}] */
function parseFeeds(raw) {
  return raw
    .split(';')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const eq = chunk.indexOf('=')
      // A bare URL with no label is fine too.
      const label = eq === -1 ? null : chunk.slice(0, eq).trim()
      const url = (eq === -1 ? chunk : chunk.slice(eq + 1)).trim()
      // webcal:// is just https:// wearing a hat — no client understands it over the wire.
      return { label, url: url.replace(/^webcal:\/\//i, 'https://') }
    })
}

async function loadFeed(feed, windowStart, windowEnd) {
  const res = await fetch(feed.url, { headers: { Accept: 'text/calendar' } })
  if (!res.ok) throw new Error(`feed returned ${res.status}`)
  const text = await res.text()

  const comp = new ICAL.Component(ICAL.parse(text))

  // Register the feed's own VTIMEZONE blocks, or every TZID-qualified time falls
  // back to UTC and the whole calendar renders hours off.
  for (const vt of comp.getAllSubcomponents('vtimezone')) {
    const tz = new ICAL.Timezone(vt)
    if (!ICAL.TimezoneService.has(tz.tzid)) ICAL.TimezoneService.register(tz.tzid, tz)
  }

  const rows = []
  for (const ve of comp.getAllSubcomponents('vevent')) {
    const event = new ICAL.Event(ve)

    if (event.isRecurring()) {
      const iterator = event.iterator()
      let next
      let count = 0
      while ((next = iterator.next()) && count < MAX_OCCURRENCES) {
        count++
        const start = next.toJSDate()
        if (start > windowEnd) break
        const details = event.getOccurrenceDetails(next)
        const end = details.endDate?.toJSDate() ?? null
        if ((end ?? start) < windowStart) continue
        rows.push(toRow(event, feed, start, end, next.toString()))
      }
    } else {
      const start = event.startDate?.toJSDate()
      if (!start) continue
      const end = event.endDate?.toJSDate() ?? null
      if (start > windowEnd || (end ?? start) < windowStart) continue
      rows.push(toRow(event, feed, start, end, null))
    }
  }
  return rows
}

function toRow(event, feed, start, end, recurrenceKey) {
  const uid = event.uid ?? `${feed.label ?? 'feed'}-${start.toISOString()}`
  return {
    title: event.summary?.trim() || 'Busy',
    starts_at: start.toISOString(),
    ends_at: end ? end.toISOString() : null,
    who: feed.label,
    location: event.location?.trim() || null,
    source: 'ics',
    // Each occurrence of a repeating event needs its own key, or they collide on
    // the (source, ext_uid) unique index and only one survives.
    ext_uid: recurrenceKey ? `${uid}::${recurrenceKey}` : uid,
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

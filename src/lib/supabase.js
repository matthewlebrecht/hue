import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** True when both env vars are present — UI can show a setup hint instead of crashing. */
export const isConfigured = Boolean(url && anonKey)

if (!isConfigured) {
  console.warn(
    '[HUE] Supabase env vars missing. Copy .env.example -> .env.local and fill in ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the dev server.'
  )
}

// A null client would blow up every call site; a client pointed at a dummy URL fails
// gracefully at request time instead, which keeps the shell renderable pre-config.
export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'anon', {
  auth: { persistSession: true, autoRefreshToken: true },
  realtime: { params: { eventsPerSecond: 5 } },
})

/**
 * Cheap round-trip to confirm the client is wired and the schema is in place.
 * Returns { ok, detail }.
 */
export async function checkConnection() {
  if (!isConfigured) {
    return { ok: false, detail: 'No Supabase URL / anon key in .env.local' }
  }
  const { error, count } = await supabase
    .from('accounts')
    .select('id', { count: 'exact', head: true })

  if (error) {
    // 42P01 = relation does not exist -> connected, schema not run yet.
    if (error.code === '42P01') {
      return { ok: false, detail: 'Connected, but the schema has not been run yet' }
    }
    return { ok: false, detail: error.message }
  }
  return { ok: true, detail: `Connected · ${count ?? 0} account${count === 1 ? '' : 's'}` }
}

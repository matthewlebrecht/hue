import { supabase } from './supabase.js'

const CACHE_KEY = 'hue.meal-ideas'

/**
 * Meal ideas are the only feature here that costs money per call, so the result
 * is cached rather than refetched on every screen open. The cache also feeds the
 * dashboard headline without the dashboard ever making its own call.
 */
export function cachedIdeas() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearCachedIdeas() {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    /* private mode — the feature still works, it just won't persist */
  }
}

export async function fetchMealIdeas() {
  const { data, error } = await supabase.functions.invoke('meal-ideas')
  if (error) throw new Error(friendlyError(error, data))
  if (data?.error) throw new Error(data.error)

  const result = { ...data, fetched_at: new Date().toISOString() }
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(result))
  } catch {
    /* non-fatal */
  }
  return result
}

function friendlyError(error, data) {
  if (data?.error) return data.error
  // The most common failure by far is the function simply not being deployed yet.
  if (/not found|404/i.test(error.message ?? '')) {
    return 'The meal-ideas function isn\'t deployed yet — run "supabase functions deploy meal-ideas".'
  }
  return error.message ?? String(error)
}

/** "2 hours ago" style staleness hint — ideas age with the kitchen. */
export function ageLabel(iso) {
  if (!iso) return null
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

import { supabase } from './supabase.js'
import { describe } from './weather.js'
import { groupByDay, comingUp, timeLabel, rangeLabel, isMultiDay } from './schedule.js'
import { usd } from './format.js'

const CACHE_KEY = 'hue.briefing'

const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Cached briefing, but only if it's from today. A briefing is a snapshot of one
 * morning — showing yesterday's on the kitchen wall would be worse than showing
 * none, because it reads as current.
 */
export function cachedBriefing() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed.day === todayKey() ? parsed : null
  } catch {
    return null
  }
}

/** Flattens what's already on screen into the shape the function prompts with. */
export function buildContext({ events, weather, inventory, money }) {
  const days = groupByDay(events, { days: 2 })
  const label = (e) => {
    const bits = [e.title]
    if (isMultiDay(e)) bits.push(`(${rangeLabel(e)})`)
    else if (!e.all_day) bits.push(`at ${timeLabel(e)}`)
    else bits.push('(all day)')
    if (e.location) bits.push(`— ${e.location}`)
    return bits.join(' ')
  }

  const overCategories = (money.budget ?? [])
    .map((b) => {
      const cat = money.categories.find((c) => c.id === b.category_id)
      const spent = money.spend.byCategory.get(b.category_id) ?? 0
      return spent > b.monthly_limit ? cat?.name : null
    })
    .filter(Boolean)

  return {
    date: new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }),
    weather: weather
      ? {
          label: describe(weather.code, weather.isDay).label,
          temp: weather.temp,
          high: weather.high,
          low: weather.low,
          rainChance: weather.rainChance,
        }
      : null,
    today: (days[0]?.label === 'Today' ? days[0].items : []).map((i) => label(i.event)),
    tomorrow: (days.find((d) => d.label === 'Tomorrow')?.items ?? []).map((i) => label(i.event)),
    upcoming: comingUp(events, { limit: 3 }).map((u) => `${u.event.title} — ${u.when}`),
    kitchen: {
      out: inventory.filter((i) => i.status === 'out').map((i) => i.item),
      low: inventory.filter((i) => i.status === 'low').map((i) => i.item),
    },
    money: {
      status: money.status.line,
      spent: usd(money.spend.total),
      limit: money.totalLimit > 0 ? usd(money.totalLimit) : null,
      overCategories,
    },
  }
}

export async function fetchBriefing(context) {
  const { data, error } = await supabase.functions.invoke('morning-briefing', {
    body: context,
  })
  if (error) throw new Error(friendly(error, data))
  if (data?.error) throw new Error(data.error)

  const result = { text: data.text, day: todayKey(), fetched_at: new Date().toISOString() }
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(result))
  } catch {
    /* non-fatal */
  }
  return result
}

function friendly(error, data) {
  if (data?.error) return data.error
  if (/not found|404/i.test(error.message ?? '')) {
    return 'The morning-briefing function isn\'t deployed yet — run "npm run deploy:briefing".'
  }
  return error.message ?? String(error)
}

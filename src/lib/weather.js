/**
 * Weather via Open-Meteo.
 *
 * Called straight from the browser on purpose: no API key, no signup, and the
 * service sends `access-control-allow-origin: *`. An Edge Function would add a
 * deploy step and a failure mode to guard a secret that doesn't exist.
 */

const LAT = import.meta.env.VITE_WEATHER_LAT ?? '40.7256'
const LON = import.meta.env.VITE_WEATHER_LON ?? '-111.8834'
export const PLACE = import.meta.env.VITE_WEATHER_PLACE ?? 'Salt Lake City'

const CACHE_KEY = 'hue.weather'

const URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
  '&current=temperature_2m,apparent_temperature,weather_code,is_day' +
  '&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max' +
  '&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=2'

/** WMO weather codes → glyph + label. Night swaps the clear-sky sun for a moon. */
const CODES = {
  0: ['☀', '🌙', 'Clear'],
  1: ['🌤', '🌙', 'Mainly clear'],
  2: ['⛅', '☁', 'Partly cloudy'],
  3: ['☁', '☁', 'Overcast'],
  45: ['🌫', '🌫', 'Fog'],
  48: ['🌫', '🌫', 'Freezing fog'],
  51: ['🌦', '🌧', 'Light drizzle'],
  53: ['🌦', '🌧', 'Drizzle'],
  55: ['🌧', '🌧', 'Heavy drizzle'],
  56: ['🌧', '🌧', 'Freezing drizzle'],
  57: ['🌧', '🌧', 'Freezing drizzle'],
  61: ['🌦', '🌧', 'Light rain'],
  63: ['🌧', '🌧', 'Rain'],
  65: ['🌧', '🌧', 'Heavy rain'],
  66: ['🌧', '🌧', 'Freezing rain'],
  67: ['🌧', '🌧', 'Freezing rain'],
  71: ['🌨', '🌨', 'Light snow'],
  73: ['🌨', '🌨', 'Snow'],
  75: ['❄', '❄', 'Heavy snow'],
  77: ['🌨', '🌨', 'Snow grains'],
  80: ['🌦', '🌧', 'Showers'],
  81: ['🌧', '🌧', 'Showers'],
  82: ['🌧', '🌧', 'Heavy showers'],
  85: ['🌨', '🌨', 'Snow showers'],
  86: ['❄', '❄', 'Snow showers'],
  95: ['⛈', '⛈', 'Thunderstorm'],
  96: ['⛈', '⛈', 'Thunderstorm'],
  99: ['⛈', '⛈', 'Hail storm'],
}

export function describe(code, isDay = true) {
  const entry = CODES[code] ?? ['·', '·', '—']
  return { icon: isDay ? entry[0] : entry[1], label: entry[2] }
}

export function cachedWeather() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export async function fetchWeather() {
  const res = await fetch(URL)
  if (!res.ok) throw new Error(`Weather service returned ${res.status}`)
  const data = await res.json()
  if (data.error) throw new Error(data.reason ?? 'Weather service error')

  const result = {
    temp: Math.round(data.current.temperature_2m),
    feelsLike: Math.round(data.current.apparent_temperature),
    code: data.current.weather_code,
    isDay: data.current.is_day === 1,
    high: Math.round(data.daily.temperature_2m_max[0]),
    low: Math.round(data.daily.temperature_2m_min[0]),
    rainChance: data.daily.precipitation_probability_max[0] ?? 0,
    tomorrow: {
      high: Math.round(data.daily.temperature_2m_max[1]),
      low: Math.round(data.daily.temperature_2m_min[1]),
      code: data.daily.weather_code[1],
      rainChance: data.daily.precipitation_probability_max[1] ?? 0,
    },
    fetched_at: new Date().toISOString(),
  }

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(result))
  } catch {
    /* non-fatal */
  }
  return result
}

/**
 * The one useful sentence — the "bring a jacket" line. Returns null when the
 * weather is unremarkable, because a line that always says something stops
 * being read.
 */
export function advice(w) {
  if (!w) return null
  // Specific weather beats a generic precipitation percentage — snow reads as a
  // high rain chance, so checking that first would call a blizzard "rain".
  if (w.code >= 71 && w.code <= 86) return 'Snow — leave early'
  if (w.code >= 95) return 'Storms today'
  if (w.rainChance >= 60) return 'Rain likely — take a jacket'
  if (w.low <= 32) return 'Freezing tonight'
  if (w.high >= 95) return 'Hot one — hydrate'
  if (w.rainChance >= 35) return 'Might rain later'
  return null
}

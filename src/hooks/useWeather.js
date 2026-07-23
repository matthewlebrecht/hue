import { useEffect, useState } from 'react'
import { fetchWeather, cachedWeather } from '../lib/weather.js'

const REFRESH_MS = 15 * 60 * 1000

/**
 * Weather, kept fresh but never blank.
 *
 * Seeded from the last cached reading so the ambient screen paints instantly on
 * boot, and a failed refresh keeps the previous value rather than clearing it.
 * Open-Meteo returns a transient 503 under load; on an always-on kitchen display
 * a stale temperature is far better than an error where the weather should be.
 */
export function useWeather() {
  const [weather, setWeather] = useState(cachedWeather)
  const [stale, setStale] = useState(false)

  useEffect(() => {
    let alive = true

    const load = async () => {
      try {
        const w = await fetchWeather()
        if (!alive) return
        setWeather(w)
        setStale(false)
      } catch {
        if (alive) setStale(true) // keep whatever we already had
      }
    }

    load()
    const timer = setInterval(load, REFRESH_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  return { weather, stale }
}

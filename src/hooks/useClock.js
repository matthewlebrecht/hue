import { useEffect, useState } from 'react'

/**
 * Ticking clock, aligned to the minute.
 *
 * The ambient screen shows minutes, so a per-second interval would re-render 59
 * times for nothing on an always-on display. This sleeps to the next minute
 * boundary instead, which also stops the clock drifting a second late.
 */
export function useClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let timer
    const schedule = () => {
      const ms = 60000 - (Date.now() % 60000)
      timer = setTimeout(() => {
        setNow(new Date())
        schedule()
      }, ms + 50)
    }
    schedule()
    return () => clearTimeout(timer)
  }, [])

  return now
}

export const timeParts = (d) => ({
  time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/i, ''),
  meridiem: d.getHours() < 12 ? 'AM' : 'PM',
  date: d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
})

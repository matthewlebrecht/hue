import { useEffect } from 'react'

/**
 * Calls onIdle after `ms` without a touch. This is what makes the iPad settle
 * back to the ambient screen on its own instead of sitting on a detail view all
 * evening. Disabled when `active` is false (no point running it on ambient).
 */
export function useIdle(ms, onIdle, active = true) {
  useEffect(() => {
    if (!active) return
    let timer
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(onIdle, ms)
    }
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart']
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    reset()
    return () => {
      clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [ms, onIdle, active])
}

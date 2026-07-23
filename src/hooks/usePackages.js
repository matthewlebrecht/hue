import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { fetchPackages, isPending, etaDate } from '../lib/packages.js'

export function usePackages() {
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      setPackages(await fetchPackages())
      setError(null)
    } catch (e) {
      setError(e.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const channel = supabase
      .channel('hue-packages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'packages' }, refresh)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [refresh])

  const pending = packages.filter(isPending)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const arrivingToday = pending.filter((p) => {
    const eta = etaDate(p)
    return eta && eta.getTime() === today.getTime()
  })

  return { packages, pending, arrivingToday, loading, error, refresh, setError }
}

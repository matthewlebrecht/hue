import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { fetchInventory, sortItems } from '../lib/inventory.js'

export function useInventory() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      setItems(await fetchInventory())
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
      .channel('hue-inventory')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, refresh)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [refresh])

  /**
   * Optimistic status flip. Tapping "low" on a kitchen iPad should move instantly;
   * waiting on a round-trip makes the grid feel broken mid-cooking. Realtime
   * reconciles, and a failure rolls back with the error shown.
   */
  const applyLocal = useCallback((id, patch) => {
    setItems((prev) => sortItems(prev.map((i) => (i.id === id ? { ...i, ...patch } : i))))
  }, [])

  const lowOrOut = items.filter((i) => i.status !== 'ok')

  return { items, lowOrOut, loading, error, refresh, applyLocal, setError }
}

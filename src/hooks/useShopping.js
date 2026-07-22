import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { fetchList, syncFromInventory } from '../lib/shopping.js'

export function useShopping(inventoryItems, inventoryLoaded) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const syncing = useRef(false)

  const refresh = useCallback(async () => {
    try {
      setRows(await fetchList())
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
      .channel('hue-shopping')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_list' }, refresh)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [refresh])

  // Reconcile whenever the kitchen or the list moves. The ref guards against a
  // sync writing, realtime firing, and that re-entering the sync.
  useEffect(() => {
    if (loading || !inventoryLoaded || syncing.current) return
    syncing.current = true
    syncFromInventory(inventoryItems, rows)
      .then((changed) => {
        if (changed > 0) return refresh()
      })
      .catch((e) => setError(e.message ?? String(e)))
      .finally(() => {
        syncing.current = false
      })
  }, [inventoryItems, inventoryLoaded, rows, loading, refresh])

  const outstanding = rows.filter((r) => !r.checked)
  const checked = rows.filter((r) => r.checked)

  return { rows, outstanding, checked, loading, error, refresh, setError }
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { fetchInventory, sortItems } from '../lib/inventory.js'

export function useInventory() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  /**
   * Display order, frozen for the life of the screen.
   *
   * Sorting by status (out -> low -> ok) is right when you ARRIVE — what needs
   * buying is at the top. It's wrong while you're tapping: marking one item low
   * re-sorted the whole grid, so the tile you meant to tap next slid to a
   * different column mid-restock. Order is therefore computed once, and status
   * changes never move anything. Leaving and re-entering the screen re-sorts.
   */
  const orderRef = useRef(null)

  const applyOrder = useCallback((list) => {
    if (!orderRef.current) orderRef.current = sortItems(list).map((i) => i.id)

    const rank = new Map(orderRef.current.map((id, i) => [id, i]))
    const known = []
    const fresh = []
    for (const item of list) (rank.has(item.id) ? known : fresh).push(item)

    known.sort((a, b) => rank.get(a.id) - rank.get(b.id))
    // Items added since the order was fixed (by us or the other phone) go last,
    // so nothing already on screen shifts.
    const merged = [...known, ...sortItems(fresh)]
    orderRef.current = merged.map((i) => i.id)
    return merged
  }, [])

  const refresh = useCallback(async () => {
    try {
      setItems(applyOrder(await fetchInventory()))
      setError(null)
    } catch (e) {
      setError(e.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }, [applyOrder])

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
   * Optimistic status flip. A tap on a kitchen screen has to move now, not after
   * a round-trip. Position is preserved — only the status changes.
   */
  const applyLocal = useCallback((id, patch) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  }, [])

  /** Re-sort on demand — used after "Just restocked", where a jump is expected. */
  const resort = useCallback(() => {
    orderRef.current = null
    setItems((prev) => applyOrder(prev))
  }, [applyOrder])

  const lowOrOut = items.filter((i) => i.status !== 'ok')

  return { items, lowOrOut, loading, error, refresh, applyLocal, resort, setError }
}

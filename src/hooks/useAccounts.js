import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { fetchAccounts } from '../lib/accounts.js'

/**
 * Accounts + computed balances, kept live.
 *
 * Balances are a computed view, so any transaction write can change them without
 * the accounts table changing at all — hence both tables are watched, and any
 * change triggers a refetch rather than a local patch. At two-person scale the
 * refetch is far cheaper than keeping a derived cache honest.
 *
 * If hue_v1_realtime.sql hasn't been run the subscription simply never fires;
 * everything still works, it just won't update without a reload.
 */
export function useAccounts() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      setAccounts(await fetchAccounts())
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
      .channel('hue-accounts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'accounts' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, refresh)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [refresh])

  const netWorth = accounts.reduce((sum, a) => sum + a.current_balance, 0)

  return { accounts, netWorth, loading, error, refresh }
}

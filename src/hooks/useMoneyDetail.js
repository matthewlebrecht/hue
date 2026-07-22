import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { currentMonth, fetchBudget, fetchMonthSpend, fetchMonthlyIncome } from '../lib/budget.js'
import { fetchGoals } from '../lib/goals.js'

/** Budget limits, month-to-date spend, goal progress and household income. */
export function useMoneyDetail() {
  const [monthKey] = useState(currentMonth)
  const [budget, setBudget] = useState([])
  const [spend, setSpend] = useState({ byCategory: new Map(), total: 0 })
  const [goals, setGoals] = useState([])
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const [b, s, g, inc] = await Promise.all([
        fetchBudget(monthKey),
        fetchMonthSpend(monthKey),
        fetchGoals(),
        fetchMonthlyIncome(),
      ])
      setBudget(b)
      setSpend(s)
      setGoals(g)
      setMonthlyIncome(inc)
      setError(null)
    } catch (e) {
      setError(e.message ?? String(e))
    }
  }, [monthKey])

  useEffect(() => {
    refresh()
    // goal progress depends on account balances, which depend on transactions —
    // so a spend three tables away still has to move a goal bar.
    const channel = supabase
      .channel('hue-money-detail')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budget' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goals' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goal_accounts' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'accounts' }, refresh)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [refresh])

  return { monthKey, budget, spend, goals, monthlyIncome, error, refresh }
}

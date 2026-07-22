import { createContext, useContext, useMemo } from 'react'
import { useAccounts } from '../hooks/useAccounts.js'
import { useTransactions } from '../hooks/useTransactions.js'
import { useMoneyDetail } from '../hooks/useMoneyDetail.js'
import { isLiability } from '../lib/accounts.js'
import { effectOn } from '../lib/transactions.js'
import { monthRange } from '../lib/budget.js'
import { usd } from '../lib/format.js'

const MoneyContext = createContext(null)

/**
 * One place the money data lives.
 *
 * Ambient, dashboard and the detail screen all want the same numbers. Mounting
 * the hooks per screen would open three sets of realtime channels and refetch on
 * every navigation, so they're hoisted here and read through context.
 */
export function MoneyProvider({ children }) {
  const { accounts, netWorth, loading, error: accountsError } = useAccounts()
  const { transactions, categories, error: txnError } = useTransactions()
  const {
    monthKey,
    budget,
    spend,
    goals,
    monthlyIncome,
    error: detailError,
    refresh,
  } = useMoneyDetail()

  const value = useMemo(() => {
    const assets = accounts.filter((a) => !isLiability(a.type))
    const debts = accounts.filter((a) => isLiability(a.type))
    const assetTotal = assets.reduce((s, a) => s + Math.max(0, a.current_balance), 0)
    const debtTotal = debts.reduce((s, a) => s + Math.abs(Math.min(0, a.current_balance)), 0)

    const { endExclusive } = monthRange(monthKey)
    const monthAssetDelta = transactions
      .filter((t) => t.txn_date >= monthKey && t.txn_date < endExclusive)
      .reduce((sum, t) => sum + assets.reduce((s, a) => s + effectOn(t, a.id), 0), 0)
    const ringBaseline = Math.max(assetTotal - monthAssetDelta, assetTotal)

    const totalLimit = budget.reduce((s, b) => s + b.monthly_limit, 0)
    const status = deriveStatus({ totalLimit, spend, assetTotal, ringBaseline })

    return {
      accounts,
      assets,
      debts,
      assetTotal,
      debtTotal,
      netWorth,
      ringBaseline,
      transactions,
      categories,
      monthKey,
      budget,
      totalLimit,
      spend,
      goals,
      monthlyIncome,
      status,
      loading,
      error: accountsError || txnError || detailError,
      refresh,
    }
  }, [
    accounts,
    netWorth,
    transactions,
    categories,
    monthKey,
    budget,
    spend,
    goals,
    monthlyIncome,
    loading,
    accountsError,
    txnError,
    detailError,
    refresh,
  ])

  return <MoneyContext.Provider value={value}>{children}</MoneyContext.Provider>
}

export function useMoney() {
  const ctx = useContext(MoneyContext)
  if (!ctx) throw new Error('useMoney must be used inside MoneyProvider')
  return ctx
}

/**
 * The one quiet signal the ambient screen shows. Budget is the truth when limits
 * exist; without any limits it falls back to how drawn-down the accounts are, so
 * the dot still says something real on day one.
 */
function deriveStatus({ totalLimit, spend, assetTotal, ringBaseline }) {
  if (totalLimit > 0) {
    const pct = spend.total / totalLimit
    if (pct > 1) return { tone: 'bad', line: `${usd(spend.total - totalLimit)} Over Budget` }
    if (pct >= 0.9) return { tone: 'warn', line: 'Close to Budget' }
    return { tone: 'ok', line: 'On Track' }
  }
  const left = ringBaseline > 0 ? assetTotal / ringBaseline : 1
  if (assetTotal <= 0) return { tone: 'bad', line: 'Accounts Empty' }
  if (left < 0.25) return { tone: 'warn', line: 'Running Low' }
  return { tone: 'ok', line: 'On Track' }
}

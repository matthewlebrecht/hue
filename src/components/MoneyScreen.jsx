import { useState } from 'react'
import { useAccounts } from '../hooks/useAccounts.js'
import { useTransactions } from '../hooks/useTransactions.js'
import { useMoneyDetail } from '../hooks/useMoneyDetail.js'
import { isLiability, typeLabel } from '../lib/accounts.js'
import { usd } from '../lib/format.js'
import AccountForm from './AccountForm.jsx'
import TransactionForm from './TransactionForm.jsx'
import TransactionList from './TransactionList.jsx'
import NetWorthRing from './NetWorthRing.jsx'
import BudgetSection from './BudgetSection.jsx'
import GoalsSection from './GoalsSection.jsx'

export default function MoneyScreen() {
  const { accounts, netWorth, loading, error } = useAccounts()
  const { transactions, categories, error: txnError } = useTransactions()
  const { monthKey, budget, spend, goals, monthlyIncome, error: detailError, refresh } =
    useMoneyDetail()
  const [editingAccount, setEditingAccount] = useState(null) // account | 'new' | null
  const [addingTxn, setAddingTxn] = useState(false)

  const assets = accounts.filter((a) => !isLiability(a.type))
  const debts = accounts.filter((a) => isLiability(a.type))

  const assetTotal = assets.reduce((s, a) => s + Math.max(0, a.current_balance), 0)
  const debtTotal = debts.reduce((s, a) => s + Math.abs(Math.min(0, a.current_balance)), 0)

  return (
    <div className="screen">
      <div className="screen__head">
        <div className="screen__title">Money</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => setEditingAccount('new')}>
            + Account
          </button>
          <button
            className="btn btn--primary"
            onClick={() => setAddingTxn(true)}
            disabled={accounts.length === 0}
          >
            + Transaction
          </button>
        </div>
      </div>

      <div className="card networth">
        {loading ? (
          <div className="networth__value">—</div>
        ) : (
          <>
            <NetWorthRing assets={assetTotal} debt={debtTotal} netWorth={netWorth} />
            {debtTotal > 0 && (
              <div className="networth__split">
                <span>{usd(assetTotal)} held</span>
                <span style={{ color: 'var(--rose)' }}>{usd(debtTotal)} owed</span>
              </div>
            )}
          </>
        )}
      </div>

      {(error || txnError || detailError) && (
        <div className="form-error" style={{ marginTop: 16 }}>
          {error || txnError || detailError}
        </div>
      )}

      {!loading && accounts.length === 0 && (
        <div className="empty">
          <p>
            No accounts yet. Add checking, savings, cards and loans — balances compute forward
            from what you enter.
          </p>
          <button className="btn btn--primary" onClick={() => setEditingAccount('new')}>
            Add the first account
          </button>
        </div>
      )}

      {assets.length > 0 && (
        <>
          <div className="section-label">Accounts</div>
          <Tiles accounts={assets} onEdit={setEditingAccount} />
        </>
      )}

      {debts.length > 0 && (
        <>
          <div className="section-label">Debt</div>
          <Tiles accounts={debts} onEdit={setEditingAccount} />
        </>
      )}

      {accounts.length > 0 && (
        <>
          <BudgetSection
            monthKey={monthKey}
            categories={categories}
            budget={budget}
            spend={spend}
            onChanged={refresh}
          />

          {monthlyIncome > 0 && (
            <div className="income-note">
              Household take-home {usd(monthlyIncome)}/mo ·{' '}
              {Math.round((spend.total / monthlyIncome) * 100)}% spent
            </div>
          )}

          <GoalsSection goals={goals} accounts={accounts} onChanged={refresh} />

          <div className="section-label" style={{ marginTop: 36 }}>
            Activity
          </div>
          <TransactionList
            transactions={transactions}
            accounts={accounts}
            categories={categories}
          />
        </>
      )}

      {editingAccount && (
        <AccountForm
          account={editingAccount === 'new' ? null : editingAccount}
          onClose={() => setEditingAccount(null)}
        />
      )}

      {addingTxn && (
        <TransactionForm
          accounts={accounts}
          categories={categories}
          onClose={() => setAddingTxn(false)}
        />
      )}
    </div>
  )
}

function Tiles({ accounts, onEdit }) {
  return (
    <div className="tiles">
      {accounts.map((a) => {
        const drifted = a.current_balance !== a.starting_balance
        return (
          <button key={a.id} className="tile" onClick={() => onEdit(a)}>
            <div className="tile__name">{a.name}</div>
            <div className="tile__type">{typeLabel(a.type)}</div>
            <div
              className={`tile__balance ${
                a.current_balance < 0 ? 'tile__balance--neg' : 'tile__balance--pos'
              }`}
            >
              {usd(a.current_balance)}
            </div>
            {drifted && <div className="tile__sub">started at {usd(a.starting_balance)}</div>}
          </button>
        )
      })}
    </div>
  )
}

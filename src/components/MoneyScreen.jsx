import { useState } from 'react'
import { useAccounts } from '../hooks/useAccounts.js'
import { useTransactions } from '../hooks/useTransactions.js'
import { isLiability, typeLabel } from '../lib/accounts.js'
import { usd, usdWhole } from '../lib/format.js'
import AccountForm from './AccountForm.jsx'
import TransactionForm from './TransactionForm.jsx'
import TransactionList from './TransactionList.jsx'

export default function MoneyScreen() {
  const { accounts, netWorth, loading, error } = useAccounts()
  const { transactions, categories, error: txnError } = useTransactions()
  const [editingAccount, setEditingAccount] = useState(null) // account | 'new' | null
  const [addingTxn, setAddingTxn] = useState(false)

  const assets = accounts.filter((a) => !isLiability(a.type))
  const debts = accounts.filter((a) => isLiability(a.type))

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
        <div className="networth__label">Net worth</div>
        <div
          className="networth__value"
          style={{ color: netWorth < 0 ? 'var(--rose)' : 'var(--text)' }}
        >
          {loading ? '—' : usdWhole(netWorth)}
        </div>
      </div>

      {(error || txnError) && (
        <div className="form-error" style={{ marginTop: 16 }}>
          {error || txnError}
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

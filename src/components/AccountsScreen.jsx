import { useState } from 'react'
import { useAccounts } from '../hooks/useAccounts.js'
import { isLiability, typeLabel } from '../lib/accounts.js'
import { usd, usdWhole } from '../lib/format.js'
import AccountForm from './AccountForm.jsx'

export default function AccountsScreen() {
  const { accounts, netWorth, loading, error } = useAccounts()
  const [editing, setEditing] = useState(null) // account object, or 'new', or null

  const assets = accounts.filter((a) => !isLiability(a.type))
  const debts = accounts.filter((a) => isLiability(a.type))

  return (
    <div className="screen">
      <div className="screen__head">
        <div className="screen__title">Money</div>
        <button className="btn" onClick={() => setEditing('new')}>
          + Account
        </button>
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

      {error && (
        <div className="form-error" style={{ marginTop: 16 }}>
          {error}
        </div>
      )}

      {!loading && accounts.length === 0 && (
        <div className="empty">
          <p>No accounts yet. Add checking, savings, cards and loans — balances compute forward from what you enter.</p>
          <button className="btn btn--primary" onClick={() => setEditing('new')}>
            Add the first account
          </button>
        </div>
      )}

      {assets.length > 0 && (
        <>
          <div className="section-label">Accounts</div>
          <Tiles accounts={assets} onEdit={setEditing} />
        </>
      )}

      {debts.length > 0 && (
        <>
          <div className="section-label">Debt</div>
          <Tiles accounts={debts} onEdit={setEditing} />
        </>
      )}

      {editing && (
        <AccountForm
          account={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
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
            {drifted && (
              <div className="tile__sub">started at {usd(a.starting_balance)}</div>
            )}
          </button>
        )
      })}
    </div>
  )
}

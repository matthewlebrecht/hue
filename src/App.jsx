import { useEffect, useState } from 'react'
import { supabase, checkConnection } from './lib/supabase.js'
import AuthGate from './components/AuthGate.jsx'

export default function App() {
  return (
    <AuthGate>
      <Shell />
    </AuthGate>
  )
}

/**
 * v1 step 1/2 placeholder: proves the app boots, the Supabase client is wired,
 * and the schema + policies are live. The real three-level shell
 * (ambient -> dashboard -> detail) lands in v1 step 6.
 */
function Shell() {
  const [status, setStatus] = useState({ state: 'checking', detail: 'Reaching Supabase…' })
  const [categories, setCategories] = useState(null)

  useEffect(() => {
    checkConnection().then((r) =>
      setStatus({ state: r.ok ? 'ok' : 'bad', detail: r.detail })
    )
    // the schema seeds 9 starter categories — a quick proof that reads work
    supabase
      .from('categories')
      .select('name')
      .order('name')
      .then(({ data }) => setCategories(data ?? []))
  }, [])

  const dotClass =
    status.state === 'ok' ? 'dot--ok' : status.state === 'bad' ? 'dot--bad' : 'dot--warn'

  return (
    <main style={{ height: '100%', display: 'grid', placeItems: 'center', padding: 'var(--gap)' }}>
      <div className="card" style={{ minWidth: 340, textAlign: 'center' }}>
        <div
          style={{
            fontSize: 40,
            letterSpacing: '0.3em',
            color: 'var(--accent)',
            marginBottom: 6,
          }}
        >
          HUE
        </div>
        <div style={{ color: 'var(--text-faint)', fontSize: 13, marginBottom: 22 }}>
          household ambient dashboard
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            color: 'var(--text-dim)',
            fontSize: 14,
          }}
        >
          <span className={`dot ${dotClass}`} />
          <span>{status.detail}</span>
        </div>

        {categories && (
          <div style={{ color: 'var(--text-faint)', fontSize: 12, marginTop: 10 }}>
            {categories.length} categories · {categories.map((c) => c.name).join(', ')}
          </div>
        )}

        <button
          onClick={() => supabase.auth.signOut()}
          style={{
            marginTop: 24,
            background: 'none',
            border: '1px solid var(--hairline)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-faint)',
            padding: '8px 14px',
            fontSize: 13,
          }}
        >
          Sign out
        </button>
      </div>
    </main>
  )
}

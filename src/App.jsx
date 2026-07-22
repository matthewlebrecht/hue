import { useEffect, useState } from 'react'
import { checkConnection } from './lib/supabase.js'

/**
 * v1 step 1 placeholder shell: proves the app boots and the Supabase client is wired.
 * The three-level shell (ambient -> dashboard -> detail) lands in v1 step 6.
 */
export default function App() {
  const [status, setStatus] = useState({ state: 'checking', detail: 'Reaching Supabase…' })

  useEffect(() => {
    let alive = true
    checkConnection().then((r) => {
      if (alive) setStatus({ state: r.ok ? 'ok' : 'bad', detail: r.detail })
    })
    return () => {
      alive = false
    }
  }, [])

  const dotClass =
    status.state === 'ok' ? 'dot--ok' : status.state === 'bad' ? 'dot--bad' : 'dot--warn'

  return (
    <main
      style={{
        height: '100%',
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--gap)',
      }}
    >
      <div className="card" style={{ minWidth: 320, textAlign: 'center' }}>
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
      </div>
    </main>
  )
}

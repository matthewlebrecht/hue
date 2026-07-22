import { useEffect, useState } from 'react'
import { supabase, isConfigured } from '../lib/supabase.js'

/**
 * Wraps the app in a session check. The kitchen iPad signs in once and stays
 * signed in (persistSession + autoRefreshToken), so this screen is a one-time
 * setup step per device, not a daily gate.
 */
export default function AuthGate({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (loading) return <Centered>…</Centered>
  if (!isConfigured) {
    return (
      <Centered>
        <p style={{ color: 'var(--text-dim)' }}>
          Missing Supabase keys — copy <code>.env.example</code> to{' '}
          <code>.env.local</code>.
        </p>
      </Centered>
    )
  }
  if (!session) return <SignIn />
  return children
}

function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setBusy(false)
  }

  return (
    <Centered>
      <form className="card" onSubmit={onSubmit} style={{ width: 340 }}>
        <div
          style={{
            fontSize: 34,
            letterSpacing: '0.3em',
            color: 'var(--accent)',
            textAlign: 'center',
            marginBottom: 4,
          }}
        >
          HUE
        </div>
        <div
          style={{
            color: 'var(--text-faint)',
            fontSize: 13,
            textAlign: 'center',
            marginBottom: 22,
          }}
        >
          sign in once on this device
        </div>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email"
          autoComplete="username"
          required
          style={inputStyle}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="password"
          autoComplete="current-password"
          required
          style={inputStyle}
        />

        {error && (
          <div style={{ color: 'var(--rose)', fontSize: 13, marginBottom: 12 }}>{error}</div>
        )}

        <button type="submit" disabled={busy} style={buttonStyle}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </Centered>
  )
}

const inputStyle = {
  width: '100%',
  padding: '14px 16px',
  marginBottom: 12,
  background: 'var(--bg)',
  border: '1px solid var(--hairline)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text)',
  fontSize: 16, // 16px keeps iOS from zooming the field on focus
  outline: 'none',
}

const buttonStyle = {
  width: '100%',
  padding: '14px 16px',
  background: 'var(--accent)',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  color: '#06232a',
  fontSize: 16,
  fontWeight: 600,
}

function Centered({ children }) {
  return (
    <main
      style={{
        height: '100%',
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--gap)',
      }}
    >
      {children}
    </main>
  )
}

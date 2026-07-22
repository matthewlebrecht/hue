import { supabase } from './lib/supabase.js'
import AuthGate from './components/AuthGate.jsx'
import MoneyScreen from './components/MoneyScreen.jsx'

export default function App() {
  return (
    <AuthGate>
      <div style={{ minHeight: '100%' }}>
        <MoneyScreen />
        <div style={{ textAlign: 'center', paddingBottom: 32 }}>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-faint)',
              fontSize: 12,
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </AuthGate>
  )
}

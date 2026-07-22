import { useCallback, useState } from 'react'
import { useIdle } from '../hooks/useIdle.js'
import { MoneyProvider } from '../state/MoneyContext.jsx'
import AmbientScreen from './AmbientScreen.jsx'
import Dashboard from './Dashboard.jsx'
import MoneyScreen from './MoneyScreen.jsx'
import PlaceholderScreen from './PlaceholderScreen.jsx'
import { supabase } from '../lib/supabase.js'

/** Back to ambient after this long untouched — kitchen iPad settles itself. */
const IDLE_MS = 3 * 60 * 1000

/**
 * The three-level shell: ambient -> dashboard -> detail.
 *
 * Plain state rather than a router: the iPad is a kiosk with no URL bar and no
 * back button, so routing would add a dependency to model something nobody can
 * see. Detail screens carry their own back affordance.
 */
export default function HueShell() {
  const [view, setView] = useState('ambient')

  const rest = useCallback(() => setView('ambient'), [])
  useIdle(IDLE_MS, rest, view !== 'ambient')

  return (
    <MoneyProvider>
      {view === 'ambient' && <AmbientScreen onWake={() => setView('dashboard')} />}

      {view === 'dashboard' && <Dashboard onOpen={setView} onRest={rest} />}

      {view !== 'ambient' && view !== 'dashboard' && (
        <Detail onBack={() => setView('dashboard')}>{renderDetail(view)}</Detail>
      )}
    </MoneyProvider>
  )
}

function renderDetail(view) {
  switch (view) {
    case 'money':
      return <MoneyScreen />
    case 'today':
      return (
        <PlaceholderScreen title="Today" phase="v3">
          The full week, mirrored read-only from Apple Calendar. Both calendars publish an{' '}
          <code>.ics</code> feed that HUE fetches on a schedule and writes into the{' '}
          <code>schedule</code> table — which already exists and is already wired to the
          Today zone. Nothing here until that fetch job is built.
        </PlaceholderScreen>
      )
    case 'kitchen':
      return (
        <PlaceholderScreen title="Kitchen" phase="v2">
          Inventory grid with one-tap ok / low / out, an add-item field, and the "just
          restocked" shortcut. Anything low or out rolls into a shopping list both phones can
          check off live. Meal ideas come after, from the same inventory.
        </PlaceholderScreen>
      )
    case 'packages':
      return (
        <PlaceholderScreen title="Packages" phase="v3">
          Deliveries parsed out of Gmail — carrier, status, ETA — surfacing as a quiet
          "arriving today" line on the ambient screen. Needs the Gmail pipe scoped to a
          label, never the whole inbox.
        </PlaceholderScreen>
      )
    case 'briefing':
      return (
        <PlaceholderScreen title="Morning briefing" phase="v3">
          One paragraph each morning: today's schedule, weather, budget status, what's low in
          the kitchen, bills due. It's a Claude API call over data HUE already holds — so it
          wants the calendar and kitchen feeds live first, or it'd be a paragraph about
          nothing.
        </PlaceholderScreen>
      )
    default:
      return null
  }
}

function Detail({ children, onBack }) {
  return (
    <div>
      <div className="detail__bar">
        <button className="btn btn--ghost btn--small" onClick={onBack}>
          ‹ Dashboard
        </button>
        <button
          className="btn btn--ghost btn--small"
          onClick={() => supabase.auth.signOut()}
          style={{ color: 'var(--text-faint)' }}
        >
          Sign out
        </button>
      </div>
      {children}
    </div>
  )
}

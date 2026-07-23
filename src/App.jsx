import AuthGate from './components/AuthGate.jsx'
import HueShell from './components/HueShell.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

export default function App() {
  return (
    <ErrorBoundary>
      <AuthGate>
        <HueShell />
      </AuthGate>
    </ErrorBoundary>
  )
}

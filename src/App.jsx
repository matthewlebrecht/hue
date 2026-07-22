import AuthGate from './components/AuthGate.jsx'
import HueShell from './components/HueShell.jsx'

export default function App() {
  return (
    <AuthGate>
      <HueShell />
    </AuthGate>
  )
}

import { Component } from 'react'

/**
 * Catches render errors so a bug shows a message instead of a blank screen.
 *
 * This matters more here than in a normal app: HUE lives on a kitchen wall with
 * no address bar, no devtools, and nobody watching the console. A white rectangle
 * gives whoever walks past nothing to act on — not even "reload".
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[HUE] render error:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 'var(--gap)',
          textAlign: 'center',
        }}
      >
        <div className="card" style={{ maxWidth: 460 }}>
          <div style={{ fontSize: 15, marginBottom: 10 }}>Something broke on this screen.</div>
          <div
            style={{
              color: 'var(--text-faint)',
              fontSize: 12,
              fontFamily: 'monospace',
              marginBottom: 20,
              wordBreak: 'break-word',
            }}
          >
            {this.state.error?.message ?? String(this.state.error)}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn" onClick={() => this.setState({ error: null })}>
              Try again
            </button>
            <button className="btn btn--primary" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      </main>
    )
  }
}

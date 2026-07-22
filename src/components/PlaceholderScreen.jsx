/**
 * Honest stand-in for the detail screens whose feeds aren't wired yet. Says what
 * will be here and what has to exist first, rather than showing a fake version.
 */
export default function PlaceholderScreen({ title, phase, children }) {
  return (
    <div className="screen">
      <div className="screen__head">
        <div className="screen__title">{title}</div>
        <span className="phase-tag">{phase}</span>
      </div>
      <div className="card" style={{ color: 'var(--text-dim)', lineHeight: 1.6, fontSize: 15 }}>
        {children}
      </div>
    </div>
  )
}

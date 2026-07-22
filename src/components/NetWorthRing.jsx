import { usdWhole } from '../lib/format.js'

/**
 * Arc-reactor ring around net worth.
 *
 * The arc shows EQUITY SHARE: what fraction of everything you hold is actually
 * yours once debt is subtracted — assets / (assets + debt). A full ring means
 * debt-free. It's a ratio on purpose: net worth has no natural maximum, so a
 * ring "filling toward" a dollar figure would be inventing a target nobody set.
 */
export default function NetWorthRing({ assets, debt, netWorth, size = 190 }) {
  const gross = assets + debt
  const equity = gross > 0 ? Math.max(0, Math.min(1, assets > 0 ? (assets - debt) / assets : 0)) : 0
  const hasDebt = debt > 0

  const stroke = 6
  const r = (size - stroke) / 2 - 6
  const circumference = 2 * Math.PI * r
  const dash = circumference * (hasDebt ? equity : 1)

  const tone = netWorth < 0 ? 'var(--rose)' : hasDebt && equity < 0.5 ? 'var(--amber)' : 'var(--accent)'

  return (
    <div className="ring">
      <svg width={size} height={size} style={{ display: 'block' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--hairline)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.3s ease' }}
        />
      </svg>
      <div className="ring__inner">
        <div className="networth__label">Net worth</div>
        <div
          className="ring__value"
          style={{ color: netWorth < 0 ? 'var(--rose)' : 'var(--text)' }}
        >
          {usdWhole(netWorth)}
        </div>
        <div className="ring__sub">
          {hasDebt ? `${Math.round(equity * 100)}% equity` : 'debt free'}
        </div>
      </div>
    </div>
  )
}

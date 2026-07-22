import { usd, usdWhole } from '../lib/format.js'

/**
 * Arc-reactor ring — how built up the accounts are.
 *
 * The arc tracks LIQUID ASSETS against this month's high-water mark: full when
 * the money is at its peak, draining toward empty as spending eats it, refilling
 * when income lands and sets a new peak. Cyan -> amber under half -> rose as it
 * approaches zero. The baseline resets each month, so the ring reads as "how much
 * of this month's money is still there" rather than an all-time score.
 *
 * Net worth stays the number in the middle; the arc is about the accounts.
 */
export default function NetWorthRing({ netWorth, assets, baseline, size = 190 }) {
  const pct =
    baseline > 0 ? Math.max(0, Math.min(1, assets / baseline)) : assets > 0 ? 1 : 0

  const tone =
    assets <= 0 ? 'var(--rose)' : pct >= 0.5 ? 'var(--accent)' : pct >= 0.25 ? 'var(--amber)' : 'var(--rose)'

  const stroke = 6
  const r = (size - stroke) / 2 - 6
  const circumference = 2 * Math.PI * r
  const dash = circumference * pct

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
          style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.4s ease' }}
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
        <div className="ring__sub" style={{ color: tone }}>
          {usd(assets)} in accounts
        </div>
      </div>
    </div>
  )
}

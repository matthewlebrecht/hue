const usdFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** $1,234.56 — negatives render as -$1,234.56 */
export const usd = (n) => usdFmt.format(Number(n) || 0)

/** $1,234 — no cents, for big glance numbers like net worth */
export const usdWhole = (n) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(n) || 0)

export const OMNIBUS_WINDOW_DAYS = 30

const DAY_MS = 86_400_000

export interface PriceSnapshotPoint {
  amount: number
  /** Regular price at that time; without it a snapshot counts as discounted. */
  original_amount?: number
  recorded_at: string | Date
}

const grosze = (amount: number) => Math.round(amount * 100)

/**
 * Omnibus: the lowest price in the 30 days before the current reduction started.
 * The reduction starts at the first snapshot of the latest run with the current price *while
 * discounted* (a raised regular price does not turn earlier full-price days into a sale), or now
 * when the change has not been recorded yet. Without earlier prices – the regular price.
 */
export function lowestPriceBeforeDiscount(
  history: PriceSnapshotPoint[],
  current: { amount: number; original_amount: number },
  now: Date,
): number | null {
  const currentAmount = grosze(current.amount)
  if (currentAmount >= grosze(current.original_amount)) return null

  const points = history
    .map((point) => ({
      amount: point.amount,
      discounted:
        point.original_amount === undefined || grosze(point.amount) < grosze(point.original_amount),
      at: new Date(point.recorded_at).getTime(),
    }))
    .sort((a, b) => a.at - b.at)

  const inCurrentRun = (point: (typeof points)[number] | undefined) =>
    point?.discounted === true && grosze(point.amount) === currentAmount
  let runStart = points.length
  while (runStart > 0 && inCurrentRun(points[runStart - 1])) runStart--
  const start = runStart < points.length ? (points[runStart]?.at ?? now.getTime()) : now.getTime()
  const before = points.slice(0, runStart)
  const windowStart = start - OMNIBUS_WINDOW_DAYS * DAY_MS

  const inWindow = before.filter((point) => point.at >= windowStart)
  const inForceAtWindowStart = before.filter((point) => point.at < windowStart).at(-1)
  const prices = [...inWindow, ...(inForceAtWindowStart ? [inForceAtWindowStart] : [])].map(
    (point) => point.amount,
  )

  return prices.length > 0 ? Math.min(...prices) : current.original_amount
}

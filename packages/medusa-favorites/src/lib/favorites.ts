import { DEFAULT_FAVORITES_LIMIT } from '../options'

export interface FavoriteEntry {
  product_id: string
  added_at: Date
}

/**
 * Account list + the browser's guest list after sign-in: one entry per product,
 * the newer date wins, dates from the future become `now`, newest first, the oldest above the
 * limit are dropped.
 */
export function mergeFavorites(
  existing: FavoriteEntry[],
  incoming: FavoriteEntry[],
  now: Date,
  limit = DEFAULT_FAVORITES_LIMIT,
): { entries: FavoriteEntry[]; trimmed: boolean } {
  const byProduct = new Map<string, FavoriteEntry>()
  for (const entry of [...existing, ...incoming]) {
    const added_at = entry.added_at.getTime() > now.getTime() ? now : entry.added_at
    const known = byProduct.get(entry.product_id)
    if (!known || known.added_at.getTime() < added_at.getTime()) {
      byProduct.set(entry.product_id, { product_id: entry.product_id, added_at })
    }
  }
  const sorted = [...byProduct.values()].sort((a, b) => b.added_at.getTime() - a.added_at.getTime())
  return { entries: sorted.slice(0, limit), trimmed: sorted.length > limit }
}

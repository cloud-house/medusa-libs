export const STOCK_STATUSES = ['in_stock', 'low_stock', 'out_of_stock'] as const
export type StockStatus = (typeof STOCK_STATUSES)[number]

/** At or below this many pieces a variant shows „Ostatnie sztuki”. */
export const LOW_STOCK_THRESHOLD = 3

/** Lower is better – used to pick the best status among matching variants. */
export const STOCK_RANK: Record<StockStatus, number> = {
  in_stock: 0,
  low_stock: 1,
  out_of_stock: 2,
}

/**
 * No pre-orders: a variant without stock is out of stock even when Medusa allows
 * backorders for it – the shop only sells what is in the warehouse.
 */
export function stockStatus(input: {
  available: number | null
  manageInventory: boolean
}): StockStatus {
  if (!input.manageInventory) return 'in_stock'
  const available = input.available ?? 0
  if (available > LOW_STOCK_THRESHOLD) return 'in_stock'
  if (available > 0) return 'low_stock'
  return 'out_of_stock'
}

/** „Dostępne od ręki” – can ship now. */
export function isAvailableNow(status: StockStatus): boolean {
  return status === 'in_stock' || status === 'low_stock'
}

export interface CurrentVariantPrice {
  variant_id: string
  amount: number
  original_amount: number
}

export interface CreatePriceSnapshot extends CurrentVariantPrice {
  region_id: string
  currency_code: string
  recorded_at: Date
}

const grosze = (amount: number) => Math.round(amount * 100)

/** Snapshots to insert: variants without history and variants whose price changed. */
export function planPriceSnapshots(
  current: CurrentVariantPrice[],
  latest: Map<string, { amount: number; original_amount: number }>,
  ctx: { region_id: string; currency_code: string; recorded_at: Date },
): CreatePriceSnapshot[] {
  return current
    .filter((price) => {
      const previous = latest.get(price.variant_id)
      return (
        !previous ||
        grosze(previous.amount) !== grosze(price.amount) ||
        grosze(previous.original_amount) !== grosze(price.original_amount)
      )
    })
    .map((price) => ({ ...price, ...ctx }))
}

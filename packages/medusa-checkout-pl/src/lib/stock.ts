import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys, getVariantAvailability } from '@medusajs/framework/utils'

type VariantRow = {
  id: string
  manage_inventory: boolean
  product?: { title: string } | null
}

/**
 * The first variant short of stock as a Polish message naming the product (Medusa's own error does
 * not say which one), or `null`. `wanted` – quantities to end up with on top of `already` (what the
 * cart holds); variants without inventory management are skipped. Backorders do not
 * count – the shop sells no pre-orders (spec 4a §6.5).
 */
export async function stockShortage(
  container: MedusaContainer,
  input: { wanted: Map<string, number>; already: Map<string, number>; channel: string | undefined },
): Promise<string | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  if (input.wanted.size === 0 || !input.channel) return null
  const { data } = await query.graph({
    entity: 'product_variant',
    fields: ['id', 'manage_inventory', 'product.title'],
    filters: { id: [...input.wanted.keys()] },
  })
  const managed = (data as unknown as VariantRow[]).filter((variant) => variant.manage_inventory)
  if (managed.length === 0) return null

  const availability = await getVariantAvailability(query, {
    variant_ids: managed.map((variant) => variant.id),
    sales_channel_id: input.channel,
  })
  for (const variant of managed) {
    const available = availability[variant.id]?.availability
    if (available === null || available === undefined) continue
    const already = input.already.get(variant.id) ?? 0
    if (already + (input.wanted.get(variant.id) ?? 0) <= available) continue
    const left = Math.max(0, available - already)
    const title = variant.product?.title ?? 'Produkt'
    return left === 0 ? `${title}: chwilowo brak w magazynie.` : `${title}: mamy tylko ${left} szt.`
  }
  return null
}

/** Sums quantities per variant. */
export function quantitiesByVariant(
  lines: ({ variant_id?: string | null; quantity: number | string } | null | undefined)[],
): Map<string, number> {
  const result = new Map<string, number>()
  for (const line of lines) {
    if (line?.variant_id) {
      result.set(line.variant_id, (result.get(line.variant_id) ?? 0) + Number(line.quantity))
    }
  }
  return result
}

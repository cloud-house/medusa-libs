import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'

/**
 * The given products the shop still sells: published and in one of the sales channels of the
 * publishable key (like `loadCatalog`). Input order kept; deleted products are not returned by
 * Query at all.
 */
export async function visibleProductIds(
  container: MedusaContainer,
  productIds: string[],
  salesChannelIds: string[],
): Promise<string[]> {
  const wanted = [...new Set(productIds)]
  if (!wanted.length || !salesChannelIds.length) return []
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: links } = await query.graph({
    entity: 'product_sales_channel',
    fields: ['product_id'],
    filters: { product_id: wanted, sales_channel_id: salesChannelIds },
  })
  const inChannel = [...new Set(links.map((link) => link.product_id as string))]
  if (!inChannel.length) return []
  const { data } = await query.graph({
    entity: 'product',
    fields: ['id'],
    filters: { id: inChannel, status: 'published' },
  })
  const visible = new Set(data.map((product) => product.id as string))
  return wanted.filter((id) => visible.has(id))
}

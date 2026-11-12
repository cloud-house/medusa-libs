import type { MedusaResponse, MedusaStoreRequest } from '@medusajs/framework/http'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { brandsOptions } from './plugin-options'

export interface StoreBrand {
  id: string
  handle: string
  name: string
  /** Published products of the brand in the sales channels of the publishable key. */
  product_count: number
}

export interface StoreBrandsResponse {
  brands: StoreBrand[]
}

/**
 * `GET /store/brands`: every brand with the number of its published products that are in a sales
 * channel of the request's publishable key (no channel – 0). Sorted by name. The plugin mounts it
 * unless `storeRoute: false`; a shop that needs other counts (stock, prices) writes its own.
 */
export async function brandsStoreRoute(req: MedusaStoreRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { messages } = brandsOptions(req.scope)
  const channelIds = new Set(req.publishable_key_context?.sales_channel_ids ?? [])
  const { data } = await query.graph({
    entity: 'brand',
    fields: [
      'id',
      'name',
      'handle',
      'products.id',
      'products.status',
      'products.sales_channels.id',
    ],
  })
  const brands = data
    .map((brand) => ({
      id: brand.id,
      handle: brand.handle,
      name: brand.name,
      product_count: (brand.products ?? []).filter(
        (product) =>
          product?.status === 'published' &&
          (product.sales_channels ?? []).some((channel) => channel && channelIds.has(channel.id)),
      ).length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, messages.sortLocale))
  res.json({ brands } satisfies StoreBrandsResponse)
}

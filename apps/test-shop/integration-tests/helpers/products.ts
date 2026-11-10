import type { MedusaContainer } from '@medusajs/framework/types'
import { ProductStatus } from '@medusajs/framework/utils'
import { createProductsWorkflow, createShippingProfilesWorkflow } from '@medusajs/medusa/core-flows'

export interface TestProductInput {
  handle: string
  /** Price in `currency`; `null` creates a variant without a price. Default 1000. */
  price?: number | null
  status?: ProductStatus
  currency?: string
}

/** A product with one variant in the sales channel, without inventory management. */
export async function createTestProduct(
  container: MedusaContainer,
  salesChannelId: string,
  input: TestProductInput,
): Promise<{ id: string; variantIds: string[] }> {
  const {
    result: [profile],
  } = await createShippingProfilesWorkflow(container).run({
    input: { data: [{ name: `Profile ${input.handle}`, type: 'default' }] },
  })
  const price = input.price === undefined ? 1000 : input.price
  const { result } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: input.handle,
          handle: input.handle,
          status: input.status ?? ProductStatus.PUBLISHED,
          shipping_profile_id: profile.id,
          sales_channels: [{ id: salesChannelId }],
          options: [{ title: 'Size', values: ['Standard'] }],
          variants: [
            {
              title: 'Standard',
              sku: `${input.handle}-standard`,
              manage_inventory: false,
              options: { Size: 'Standard' },
              prices:
                price === null ? [] : [{ currency_code: input.currency ?? 'pln', amount: price }],
            },
          ],
        },
      ],
    },
  })
  const [product] = result
  if (!product) throw new Error('createProductsWorkflow returned no product')
  return { id: product.id, variantIds: (product.variants ?? []).map((variant) => variant.id) }
}

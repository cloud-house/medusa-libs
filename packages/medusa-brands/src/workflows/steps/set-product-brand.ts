import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk'
import { BRAND_MODULE } from '../../modules/brand'
import type BrandModuleService from '../../modules/brand/service'

export type SetProductBrandInput = { product_id: string; brand_id: string | null }

type Previous = { product_id: string; brand_id: string | null; next_brand_id: string | null }

const linkOf = (productId: string, brandId: string) => ({
  [Modules.PRODUCT]: { product_id: productId },
  [BRAND_MODULE]: { brand_id: brandId },
})

/** Replaces the product's brand link (or removes it for `brand_id: null`). */
export const setProductBrandStep = createStep(
  'set-product-brand',
  async (input: SetProductBrandInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const link = container.resolve(ContainerRegistrationKeys.LINK)

    await container.resolve(Modules.PRODUCT).retrieveProduct(input.product_id)
    if (input.brand_id) {
      const brands: BrandModuleService = container.resolve(BRAND_MODULE)
      await brands.retrieveBrand(input.brand_id)
    }

    const { data } = await query.graph({
      entity: 'product',
      fields: ['id', 'brand.id'],
      filters: { id: input.product_id },
    })
    const previousBrandId: string | null = data[0]?.brand?.id ?? null

    if (previousBrandId !== input.brand_id) {
      if (previousBrandId) await link.dismiss(linkOf(input.product_id, previousBrandId))
      if (input.brand_id) await link.create(linkOf(input.product_id, input.brand_id))
    }

    return new StepResponse(
      {
        product_id: input.product_id,
        brand_id: input.brand_id,
        previous_brand_id: previousBrandId,
      },
      { product_id: input.product_id, brand_id: previousBrandId, next_brand_id: input.brand_id },
    )
  },
  async (previous: Previous | undefined, { container }) => {
    if (!previous || previous.brand_id === previous.next_brand_id) return
    const link = container.resolve(ContainerRegistrationKeys.LINK)
    if (previous.next_brand_id)
      await link.dismiss(linkOf(previous.product_id, previous.next_brand_id))
    if (previous.brand_id) await link.create(linkOf(previous.product_id, previous.brand_id))
  },
)

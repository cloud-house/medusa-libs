import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk'
import { BRAND_MODULE } from '../../modules/brand'
import type BrandModuleService from '../../modules/brand/service'

export const deleteBrandStep = createStep(
  'delete-brand',
  async (input: { id: string }, { container }) => {
    const brands: BrandModuleService = container.resolve(BRAND_MODULE)
    const brand = await brands.retrieveBrand(input.id)
    await brands.deleteBrands(brand.id)
    return new StepResponse(
      { id: brand.id, handle: brand.handle },
      { id: brand.id, name: brand.name, handle: brand.handle },
    )
  },
  async (brand, { container }) => {
    if (!brand) return
    const brands: BrandModuleService = container.resolve(BRAND_MODULE)
    await brands.createBrands(brand)
  },
)

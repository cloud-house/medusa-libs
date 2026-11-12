import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk'
import { BRAND_MODULE } from '../../modules/brand'
import type BrandModuleService from '../../modules/brand/service'

export const createBrandStep = createStep(
  'create-brand',
  async (input: { name: string; handle: string }, { container }) => {
    const brands: BrandModuleService = container.resolve(BRAND_MODULE)
    const brand = await brands.createBrands(input)
    return new StepResponse(brand, brand.id)
  },
  async (id, { container }) => {
    if (!id) return
    const brands: BrandModuleService = container.resolve(BRAND_MODULE)
    await brands.deleteBrands(id)
  },
)

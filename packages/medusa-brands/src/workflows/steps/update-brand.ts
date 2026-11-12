import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk'
import { BRAND_MODULE } from '../../modules/brand'
import type BrandModuleService from '../../modules/brand/service'

export type UpdateBrandStepInput = { id: string; name?: string; handle?: string }

export const updateBrandStep = createStep(
  'update-brand',
  async (input: UpdateBrandStepInput, { container }) => {
    const brands: BrandModuleService = container.resolve(BRAND_MODULE)
    const previous = await brands.retrieveBrand(input.id)
    const brand = await brands.updateBrands(input)
    return new StepResponse(
      { brand, previous_handle: previous.handle },
      { id: previous.id, name: previous.name, handle: previous.handle },
    )
  },
  async (previous, { container }) => {
    if (!previous) return
    const brands: BrandModuleService = container.resolve(BRAND_MODULE)
    await brands.updateBrands(previous)
  },
)

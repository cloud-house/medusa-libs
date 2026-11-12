import { HANDLE_PATTERN } from '@cloud-house/commerce-rules'
import { MedusaError } from '@medusajs/framework/utils'
import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk'
import { BRAND_ERROR_CODES } from '../../errors'
import { fill } from '../../lib/fill'
import { brandsOptions } from '../../lib/plugin-options'
import { BRAND_MODULE } from '../../modules/brand'
import type BrandModuleService from '../../modules/brand/service'

export const assertBrandHandleFreeStep = createStep(
  'assert-brand-handle-free',
  async (input: { handle: string; except_id?: string }, { container }) => {
    const { messages } = brandsOptions(container)
    if (!HANDLE_PATTERN.test(input.handle)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        messages.handleUnderivable,
        BRAND_ERROR_CODES.handleUnderivable,
      )
    }
    const brands = container.resolve<BrandModuleService>(BRAND_MODULE)
    const [existing] = await brands.listBrands({ handle: input.handle })
    if (existing && existing.id !== input.except_id) {
      // Medusa's error handler replaces the `code` of a DUPLICATE_ERROR; the routes read it from here.
      throw new MedusaError(
        MedusaError.Types.DUPLICATE_ERROR,
        fill(messages.handleTaken, { handle: input.handle }),
        BRAND_ERROR_CODES.handleTaken,
      )
    }
    return new StepResponse(undefined)
  },
)

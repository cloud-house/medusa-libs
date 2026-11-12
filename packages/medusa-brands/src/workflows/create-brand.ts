import { slugify } from '@cloud-house/commerce-rules'
import { createWorkflow, transform, WorkflowResponse } from '@medusajs/framework/workflows-sdk'
import { emitEventStep } from '@medusajs/medusa/core-flows'
import { BRAND_EVENTS } from '../events'
import { assertBrandHandleFreeStep } from './steps/assert-brand-handle-free'
import { createBrandStep } from './steps/create-brand'

export type CreateBrandWorkflowInput = { name: string; handle?: string }

export const createBrandWorkflow = createWorkflow(
  'create-brand',
  (input: CreateBrandWorkflowInput) => {
    const data = transform({ input }, ({ input }) => ({
      name: input.name.trim(),
      handle: input.handle ?? slugify(input.name),
    }))
    assertBrandHandleFreeStep({ handle: data.handle })
    const brand = createBrandStep(data)
    const eventData = transform({ brand }, ({ brand }) => ({ id: brand.id, handle: brand.handle }))
    emitEventStep({ eventName: BRAND_EVENTS.created, data: eventData })
    return new WorkflowResponse(brand)
  },
)

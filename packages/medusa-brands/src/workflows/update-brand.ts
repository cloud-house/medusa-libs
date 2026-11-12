import {
  createWorkflow,
  transform,
  WorkflowResponse,
  when,
} from '@medusajs/framework/workflows-sdk'
import { emitEventStep } from '@medusajs/medusa/core-flows'
import { BRAND_EVENTS } from '../events'
import { assertBrandHandleFreeStep } from './steps/assert-brand-handle-free'
import { type UpdateBrandStepInput, updateBrandStep } from './steps/update-brand'

export const updateBrandWorkflow = createWorkflow('update-brand', (input: UpdateBrandStepInput) => {
  when({ input }, ({ input }) => input.handle !== undefined).then(() => {
    const check = transform({ input }, ({ input }) => ({
      handle: input.handle as string,
      except_id: input.id,
    }))
    assertBrandHandleFreeStep(check)
  })
  const data = transform({ input }, ({ input }) => ({
    ...input,
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
  }))
  const { brand, previous_handle } = updateBrandStep(data)
  const eventData = transform({ brand, previous_handle }, ({ brand, previous_handle }) => ({
    id: brand.id,
    handle: brand.handle,
    ...(previous_handle !== brand.handle ? { previous_handle } : {}),
  }))
  emitEventStep({ eventName: BRAND_EVENTS.updated, data: eventData })
  return new WorkflowResponse(brand)
})

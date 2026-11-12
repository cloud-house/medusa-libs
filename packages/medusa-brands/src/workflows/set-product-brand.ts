import { createWorkflow, WorkflowResponse } from '@medusajs/framework/workflows-sdk'
import { emitEventStep } from '@medusajs/medusa/core-flows'
import { BRAND_EVENTS } from '../events'
import { type SetProductBrandInput, setProductBrandStep } from './steps/set-product-brand'

export const setProductBrandWorkflow = createWorkflow(
  'set-product-brand',
  (input: SetProductBrandInput) => {
    const result = setProductBrandStep(input)
    emitEventStep({ eventName: BRAND_EVENTS.productBrandUpdated, data: result })
    return new WorkflowResponse(result)
  },
)

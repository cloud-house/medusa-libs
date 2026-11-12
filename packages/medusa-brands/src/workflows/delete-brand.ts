import type { DeleteEntityInput } from '@medusajs/framework/modules-sdk'
import { createWorkflow, transform, WorkflowResponse } from '@medusajs/framework/workflows-sdk'
import { emitEventStep, removeRemoteLinkStep } from '@medusajs/medusa/core-flows'
import { BRAND_EVENTS } from '../events'
import { BRAND_MODULE } from '../modules/brand'
import { deleteBrandStep } from './steps/delete-brand'

export const deleteBrandWorkflow = createWorkflow('delete-brand', (input: { id: string }) => {
  const deleted = deleteBrandStep(input)
  const links = transform(
    { input },
    ({ input }): DeleteEntityInput => ({ [BRAND_MODULE]: { brand_id: input.id } }),
  )
  removeRemoteLinkStep(links)
  emitEventStep({ eventName: BRAND_EVENTS.deleted, data: deleted })
  return new WorkflowResponse(deleted)
})

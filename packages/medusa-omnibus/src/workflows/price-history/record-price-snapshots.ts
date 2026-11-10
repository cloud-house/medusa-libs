import {
  createWorkflow,
  transform,
  WorkflowResponse,
  when,
} from '@medusajs/framework/workflows-sdk'
import { emitEventStep } from '@medusajs/medusa/core-flows'
import { recordPriceSnapshotsStep } from './steps/record-price-snapshots'

export const PRICE_HISTORY_RECORDED = 'price-history.recorded'

/** Records the current price of every published variant when it changed (Omnibus history). */
export const recordPriceSnapshotsWorkflow = createWorkflow(
  'record-price-snapshots',
  (input: { now?: string }) => {
    const result = recordPriceSnapshotsStep(input)
    when({ result }, ({ result }) => result.recorded > 0).then(() => {
      const data = transform({ result }, ({ result }) => ({ variant_ids: result.variant_ids }))
      emitEventStep({ eventName: PRICE_HISTORY_RECORDED, data })
    })
    return new WorkflowResponse(result)
  },
)

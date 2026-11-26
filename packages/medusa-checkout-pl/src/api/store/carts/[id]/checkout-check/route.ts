import type { CheckoutCheckResponse } from '@cloud-house/commerce-rules'
import type { MedusaResponse, MedusaStoreRequest } from '@medusajs/framework/http'
import { runCheckoutCheck } from '../../../../../lib/checkout-check'

/** Last check before the payment: delivery still fits, items in stock (spec 3b §4.5). */
export async function POST(req: MedusaStoreRequest, res: MedusaResponse) {
  const problem = await runCheckoutCheck(
    req.scope,
    req.params.id as string,
    req.publishable_key_context?.sales_channel_ids?.[0],
  )
  // 200 also for a problem: the JS SDK keeps only the message of an error response, not `field`.
  res.json(
    (problem
      ? { ok: false, field: problem.field, message: problem.message }
      : { ok: true }) satisfies CheckoutCheckResponse,
  )
}

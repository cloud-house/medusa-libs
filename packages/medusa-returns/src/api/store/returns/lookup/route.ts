import type { ReturnLookupResponse } from '@cloud-house/commerce-rules'
import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { findGuestOrder, GUEST_NOT_FOUND } from '../../../../lib/claim'
import { returnsOptions } from '../../../../lib/plugin-options'
import { loadReturnPolicy } from '../../../../lib/policy'
import { toReturnInfo } from '../../../../lib/view'
import type { StoreReturnLookupType } from '../validators'

/**
 * What a guest may return from the order with this number and e-mail (spec 6e-b §5.5). A wrong
 * number and a wrong e-mail get the same 404; no address and no e-mail ever leave here.
 */
export async function POST(req: MedusaRequest<StoreReturnLookupType>, res: MedusaResponse) {
  const { display_id, email } = req.validatedBody
  const orderId = await findGuestOrder(req.scope, display_id, email)
  const order = orderId ? await returnsOptions(req.scope).resolveOrder(req.scope, orderId) : null
  if (!order) {
    res.status(404).json(GUEST_NOT_FOUND)
    return
  }
  const policy = await loadReturnPolicy(req.scope)
  res.json({
    display_id: order.displayId,
    returns: toReturnInfo(order, policy.days, new Date()),
  } satisfies ReturnLookupResponse)
}

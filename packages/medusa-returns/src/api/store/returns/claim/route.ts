import type { ReturnClaimResponse } from '@cloud-house/commerce-rules'
import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import {
  claimReturn,
  findGuestOrder,
  GUEST_NOT_FOUND,
  ReturnClaimError,
} from '../../../../lib/claim'
import type { StoreReturnClaimType } from '../validators'

/** A guest's return request (spec 6e-b §5.5); the order is found as in `lookup`. */
export async function POST(req: MedusaRequest<StoreReturnClaimType>, res: MedusaResponse) {
  const { display_id, email, items, note } = req.validatedBody
  const orderId = await findGuestOrder(req.scope, display_id, email)
  if (!orderId) {
    res.status(404).json(GUEST_NOT_FOUND)
    return
  }
  try {
    const created = await claimReturn(req.scope, { orderId, items, note: note || null })
    res.json({ display_id, return: created } satisfies ReturnClaimResponse)
  } catch (error) {
    if (!(error instanceof ReturnClaimError)) throw error
    res.status(error.status).json({ type: error.type, message: error.message })
  }
}

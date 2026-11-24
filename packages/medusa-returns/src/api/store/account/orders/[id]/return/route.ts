import type { ReturnClaimResponse } from '@cloud-house/commerce-rules'
import { ownOrder } from '@cloud-house/medusa-accounts'
import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { claimReturn, ReturnClaimError } from '../../../../../../lib/claim'
import type { StoreAccountReturnType } from '../../../../returns/validators'

/** A signed-in customer's return request for their own order (spec 6e-b §5.4). */
export async function POST(
  req: AuthenticatedMedusaRequest<StoreAccountReturnType>,
  res: MedusaResponse,
) {
  const found = await ownOrder(req)
  if (!found) {
    res.status(404).json({ type: 'not_found', message: 'Nie znaleziono zamówienia.' })
    return
  }
  try {
    const { items, note } = req.validatedBody
    const created = await claimReturn(req.scope, { orderId: found.id, items, note: note || null })
    res.json({ display_id: found.display_id, return: created } satisfies ReturnClaimResponse)
  } catch (error) {
    if (!(error instanceof ReturnClaimError)) throw error
    res.status(error.status).json({ type: error.type, message: error.message })
  }
}

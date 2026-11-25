import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { retryPickups } from '../../../../../lib/create'
import type { AdminShipmentPickupType } from '../../../shipping/validators'

/** „Zamów odbiór” in the card for a shipment whose pickup was not ordered (spec 6d §5.5). */
export async function POST(req: MedusaRequest<AdminShipmentPickupType>, res: MedusaResponse) {
  const [result] = await retryPickups(
    req.scope,
    [req.params.id as string],
    req.validatedBody.pickup,
  )
  res.json({ result })
}

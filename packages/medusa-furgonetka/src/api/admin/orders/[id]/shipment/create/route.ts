import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { createShipments } from '../../../../../../lib/create'
import { saveDraft } from '../../../../../../lib/drafts'
import { loadCard, refusing } from '../../../../shipping/helpers'
import type { AdminOrderShipmentType } from '../../../../shipping/validators'

/**
 * „Utwórz przesyłkę”: the plan of the card is saved as the draft, then the shipment is created
 * from it (spec 6d §5.5). The draft stays when the creation fails, so „Spróbuj ponownie” has
 * something to start from. A creation that does not work is `result.ok: false` with the reason.
 */
export async function POST(req: MedusaRequest<AdminOrderShipmentType>, res: MedusaResponse) {
  const orderId = req.params.id as string
  const { draft, pickup } = req.validatedBody
  await refusing(() => saveDraft(req.scope, orderId, draft))
  const [result] = await createShipments(req.scope, [orderId], pickup)
  res.json({ ...(await loadCard(req, orderId)), result })
}

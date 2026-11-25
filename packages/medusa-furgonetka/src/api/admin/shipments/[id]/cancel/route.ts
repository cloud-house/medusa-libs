import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { adminShipmentView } from '../../../../../lib/admin-view'
import { cancelShipment } from '../../../../../lib/cancel'
import { refusing } from '../../../shipping/helpers'

/** „Anuluj przesyłkę” in the card (spec 6d §5.9); a refusal is 400 with the reason. */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const row = await refusing(() => cancelShipment(req.scope, req.params.id as string))
  res.json({ shipment: adminShipmentView(row) })
}

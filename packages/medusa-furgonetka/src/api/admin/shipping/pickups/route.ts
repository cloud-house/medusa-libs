import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { retryPickups } from '../../../../lib/create'
import type { AdminOrderPickupsType } from '../validators'

/** „Zamów odbiór” again for shipments whose pickup was not ordered (spec 6d §5.4). */
export async function POST(req: MedusaRequest<AdminOrderPickupsType>, res: MedusaResponse) {
  const { shipment_ids, pickup } = req.validatedBody
  res.json({ results: await retryPickups(req.scope, shipment_ids, pickup) })
}

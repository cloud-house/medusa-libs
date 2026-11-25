import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { loadCard } from '../../../shipping/helpers'

/** The „Wysyłka” card of an order (spec 6d §5.5). */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json(await loadCard(req, req.params.id as string))
}

import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { loadAdminInvoice } from '../../../../../lib/admin-view'

/** The „Faktura” card of an order (spec 6c §5.7). */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json(await loadAdminInvoice(req.scope, req.params.id as string))
}

import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { processInvoice } from '../../../../../../lib/process'
import { invoiceAction } from '../helpers'

/** „Wystaw fakturę” / „Wystaw ponownie”. */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  res.json(
    await invoiceAction(req, (orderId) => processInvoice(req.scope, orderId, { manual: true })),
  )
}

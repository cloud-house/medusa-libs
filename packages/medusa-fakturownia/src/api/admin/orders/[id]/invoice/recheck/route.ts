import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { recheckInvoice } from '../../../../../../lib/process'
import { invoiceAction } from '../helpers'

/** „Sprawdź ponownie” – after the team fixed the invoice in Fakturownia. */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  res.json(await invoiceAction(req, (orderId) => recheckInvoice(req.scope, orderId)))
}

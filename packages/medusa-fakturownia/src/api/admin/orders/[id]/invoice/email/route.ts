import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { resendInvoiceEmail } from '../../../../../../lib/process'
import { invoiceAction } from '../helpers'

/** „Wyślij mail ponownie”. */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  res.json(await invoiceAction(req, (orderId) => resendInvoiceEmail(req.scope, orderId)))
}

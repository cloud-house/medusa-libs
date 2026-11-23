import { ownOrder } from '@cloud-house/medusa-accounts'
import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { InvoicePdfUnavailableError, invoicePdf } from '../../../../../../lib/process'

const NOT_FOUND = { type: 'not_found', message: 'Nie znaleziono faktury.' }

/** The PDF of a ready invoice of the customer's own order (spec 6c §5.8). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const order = await ownOrder(req)
  let file: Awaited<ReturnType<typeof invoicePdf>> = null
  try {
    file = order ? await invoicePdf(req.scope, order.id) : null
  } catch (error) {
    if (!(error instanceof InvoicePdfUnavailableError)) throw error
    res.status(503).json({ type: 'unavailable', message: error.message })
    return
  }
  if (!file) {
    res.status(404).json(NOT_FOUND)
    return
  }
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`)
  res.setHeader('Cache-Control', 'private, no-store')
  res.send(file.pdf)
}

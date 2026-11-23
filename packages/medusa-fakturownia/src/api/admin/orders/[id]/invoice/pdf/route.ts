import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { MedusaError } from '@medusajs/framework/utils'
import { InvoicePdfUnavailableError, invoicePdf } from '../../../../../../lib/process'

/** „Pobierz PDF” of a ready invoice. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  let file: Awaited<ReturnType<typeof invoicePdf>>
  try {
    file = await invoicePdf(req.scope, req.params.id as string)
  } catch (error) {
    if (!(error instanceof InvoicePdfUnavailableError)) throw error
    res.status(503).json({ type: 'unavailable', message: error.message })
    return
  }
  if (!file) throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Faktura nie jest gotowa.')
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`)
  res.setHeader('Cache-Control', 'private, no-store')
  res.send(file.pdf)
}

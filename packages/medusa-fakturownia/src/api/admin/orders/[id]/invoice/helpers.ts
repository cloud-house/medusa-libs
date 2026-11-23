import type { MedusaRequest } from '@medusajs/framework/http'
import { MedusaError } from '@medusajs/framework/utils'
import { type AdminInvoiceResponse, loadAdminInvoice } from '../../../../../lib/admin-view'
import { InvoiceActionError } from '../../../../../lib/process'

/** Runs a card action on an existing order; a refused action is a 400 with the reason. */
export async function invoiceAction(
  req: MedusaRequest,
  action: (orderId: string) => Promise<unknown>,
): Promise<AdminInvoiceResponse> {
  const orderId = req.params.id as string
  await loadAdminInvoice(req.scope, orderId)
  try {
    await action(orderId)
  } catch (error) {
    if (error instanceof InvoiceActionError) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, error.message)
    }
    throw error
  }
  return loadAdminInvoice(req.scope, orderId)
}

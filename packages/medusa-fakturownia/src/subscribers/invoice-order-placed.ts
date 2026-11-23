import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { logPrefix } from '../lib/plugin-options'
import { ensureInvoiceRow, processInvoice } from '../lib/process'

/** The invoice row of a shop order and, for a paid order, the invoice (spec 6c §5.2). */
export default async function invoiceOnOrderPlaced({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  try {
    await ensureInvoiceRow(container, event.data.id)
    await processInvoice(container, event.data.id)
  } catch (error) {
    // A failed invoice never touches the order – the job retries rows; a row that could not be
    // created gets a second chance at `payment.captured`.
    const message = (error as { message?: unknown } | null)?.message ?? error
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error(
        `${logPrefix(container)} Faktura do zamówienia ${event.data.id} nie powstała: ${String(message)}`,
      )
  }
}

export const config: SubscriberConfig = { event: 'order.placed' }

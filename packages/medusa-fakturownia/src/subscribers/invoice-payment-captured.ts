import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { logPrefix } from '../lib/plugin-options'
import { ensureInvoiceRow, processInvoice } from '../lib/process'

/**
 * BLIK and Przelewy24 settle after the order exists: the Stripe webhook captures the payment
 * (`capturePaymentWorkflow` emits `payment.captured` with the payment id) – the invoice can go.
 * A card's later webhook emits it too; the invoice is then already there.
 */
export default async function invoiceOnPaymentCaptured({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: payments } = await query.graph({
      entity: 'payment',
      fields: ['payment_collection_id'],
      filters: { id: event.data.id },
    })
    const collectionId = (payments[0] as { payment_collection_id?: string } | undefined)
      ?.payment_collection_id
    if (!collectionId) return
    const { data: links } = await query.graph({
      entity: 'order_payment_collection',
      fields: ['order_id'],
      filters: { payment_collection_id: collectionId },
    })
    // No order yet: the webhook beat the cart completion – `order.placed` follows.
    for (const link of links as { order_id: string }[]) {
      // Also a second chance for the row, in case `order.placed` failed to create it.
      await ensureInvoiceRow(container, link.order_id)
      await processInvoice(container, link.order_id)
    }
  } catch (error) {
    const message = (error as { message?: unknown } | null)?.message ?? error
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error(
        `${logPrefix(container)} Faktura po płatności ${event.data.id} nie powstała: ${String(message)}`,
      )
  }
}

export const config: SubscriberConfig = { event: 'payment.captured' }

import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { ensureCorrectionRow, processCorrection } from '../lib/correction'
import { logPrefix } from '../lib/plugin-options'

/**
 * The credit note of a received return (spec 6e-b, D5) – the admin's „receive” emits this event
 * for a full and for a partial receipt. A failure never touches the return; the job retries rows
 * and also finds returns this event missed.
 */
export default async function returnReceived({
  event,
  container,
}: SubscriberArgs<{ order_id: string; return_id: string }>) {
  const { order_id: orderId, return_id: returnId } = event.data
  try {
    const row = await ensureCorrectionRow(container, orderId, returnId)
    if (row) await processCorrection(container, returnId)
  } catch (error) {
    // Workflow and module errors arrive as plain objects with `message`, not as `Error` instances.
    const message = (error as { message?: unknown } | null)?.message ?? error
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error(
        `${logPrefix(container)} Korekta faktury do zwrotu ${returnId} zamówienia ${orderId}: ${String(message)}`,
      )
  }
}

export const config: SubscriberConfig = { event: 'order.return_received' }

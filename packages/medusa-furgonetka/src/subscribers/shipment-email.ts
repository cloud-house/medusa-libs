import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { prefixedLogger } from '../lib/log'
import { orderIdOfFulfillment } from '../lib/shipment-email'
import { sendShipmentEmailWorkflow } from '../workflows/send-shipment-email'

/** „zamówienia #1001 (order_…)” – the number the shop and the admin show, with the id; the fulfillment if unknown. */
async function shipmentLabel(container: MedusaContainer, fulfillmentId: string): Promise<string> {
  try {
    const orderId = await orderIdOfFulfillment(container, fulfillmentId)
    if (!orderId) return `realizacji ${fulfillmentId}`
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: 'order',
      fields: ['display_id'],
      filters: { id: orderId },
    })
    const displayId = (data[0] as { display_id?: number | null } | undefined)?.display_id
    return displayId ? `zamówienia #${displayId} (${orderId})` : `zamówienia ${orderId}`
  } catch {
    return `realizacji ${fulfillmentId}`
  }
}

/**
 * „Paczka w drodze” when a fulfillment is marked as shipped (spec 6d §5.8) – by the Furgonetka
 * status sync or by hand in the admin. `no_notification` silences it; a failure never touches the
 * shipment.
 */
export default async function shipmentEmail({
  event,
  container,
}: SubscriberArgs<{ id: string; no_notification?: boolean }>) {
  if (event.data.no_notification) return
  try {
    await sendShipmentEmailWorkflow(container).run({ input: { fulfillmentId: event.data.id } })
  } catch (error) {
    // Workflow errors arrive as plain objects with `message`, not as `Error` instances.
    const message = (error as { message?: unknown } | null)?.message ?? error
    prefixedLogger(container).error(
      `E-mail o wysyłce ${await shipmentLabel(container, event.data.id)} nie wyszedł: ${String(message)}`,
    )
  }
}

export const config: SubscriberConfig = { event: 'shipment.created' }

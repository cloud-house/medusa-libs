import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { cancelShipmentOfFulfillment } from '../lib/cancel'
import { errorText } from '../lib/create'
import { prefixedLogger } from '../lib/log'

/**
 * A fulfillment canceled in the Medusa panel takes its Furgonetka package with it (spec 6d §5.9),
 * when that is still possible; if not, the shipment card says so and the shop gets an alert. A
 * failure is logged and never touches the cancel that happened.
 */
export default async function shipmentFulfillmentCanceled({
  event,
  container,
}: SubscriberArgs<{ order_id: string; fulfillment_id: string; no_notification?: boolean }>) {
  try {
    await cancelShipmentOfFulfillment(container, event.data.fulfillment_id)
  } catch (error) {
    prefixedLogger(container).error(
      `Anulowanie przesyłki po anulowaniu realizacji ${event.data.fulfillment_id} (zamówienie ${event.data.order_id}) nie powiodło się: ${errorText(error)}`,
    )
  }
}

export const config: SubscriberConfig = { event: 'order.fulfillment_canceled' }

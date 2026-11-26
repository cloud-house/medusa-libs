import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { reviewOrderDelivery } from '../lib/delivery-review'
import { logPrefix } from '../lib/plugin-options'

/** Flags parcel locker orders with items that do not fit (spec 3b §4.5). */
export default async function orderDeliveryReview({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  try {
    await reviewOrderDelivery(container, event.data.id)
  } catch (error) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .warn(
        `${logPrefix(container)} nie udało się sprawdzić dostawy zamówienia ${event.data.id}: ${error}`,
      )
  }
}

export const config: SubscriberConfig = { event: 'order.placed' }

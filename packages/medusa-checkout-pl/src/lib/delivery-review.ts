import type { DeliveryReview } from '@cloud-house/commerce-rules'
import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import { optionCodes } from './checkout-check'
import { parcelLockerBlockers } from './parcel-blockers'
import { checkoutPlOptions } from './plugin-options'

type OrderRow = {
  id: string
  metadata: Record<string, unknown> | null
  items?:
    | ({ product_id: string | null; product_title: string | null; title: string } | null)[]
    | null
  shipping_methods?: ({ shipping_option_id: string | null } | null)[] | null
}

/**
 * Why the staff has to look at the delivery of an order (spec 3b §4.5, spec 6d §5.2): a bulky
 * item (a board or a „Tylko kurier” product) in an order for a parcel locker or for the InPost
 * courier. Shared by the staff flag below and the confirmation e-mail, which both run on
 * `order.placed`.
 */
export async function orderNeedsCourier(
  container: MedusaContainer,
  orderId: string,
): Promise<{ review: DeliveryReview | null; order: OrderRow | null }> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: 'order',
    fields: [
      'id',
      'metadata',
      'items.product_id',
      'items.product_title',
      'items.title',
      'shipping_methods.shipping_option_id',
    ],
    filters: { id: orderId },
  })
  const order = (data[0] as unknown as OrderRow | undefined) ?? null
  if (!order) return { review: null, order }
  const optionIds = (order.shipping_methods ?? []).flatMap((m) =>
    m?.shipping_option_id ? [m.shipping_option_id] : [],
  )
  const codes = [...(await optionCodes(container, optionIds)).values()]
  const { deliveryCodes } = checkoutPlOptions(container)
  const inLocker = codes.includes(deliveryCodes.inpostLocker)
  const inInpostCourier = codes.includes(deliveryCodes.inpostCourier)
  if (!inLocker && !inInpostCourier) return { review: null, order }

  const items = (order.items ?? []).flatMap((item) =>
    item ? [{ product_id: item.product_id, title: item.product_title ?? item.title }] : [],
  )
  if ((await parcelLockerBlockers(container, items)).length === 0) return { review: null, order }
  return { review: inLocker ? 'board_to_parcel_locker' : 'bulky_with_inpost_courier', order }
}

/**
 * After payment the order is never rejected (spec 3b §2): an order for a parcel locker or the
 * InPost courier with a bulky item gets a flag for the staff to switch it to DPD. Returns `true`
 * when the order was flagged.
 */
export async function reviewOrderDelivery(
  container: MedusaContainer,
  orderId: string,
): Promise<boolean> {
  const { review, order } = await orderNeedsCourier(container, orderId)
  if (!review || !order) return false
  await container
    .resolve(Modules.ORDER)
    .updateOrders([
      { id: order.id, metadata: { ...(order.metadata ?? {}), delivery_review: review } },
    ])
  return true
}

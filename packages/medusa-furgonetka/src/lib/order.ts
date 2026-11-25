import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import type { ShippingOrder } from '../types'
import { parcelClassesOf } from './parcel-classes'
import { furgonetkaOptions } from './plugin-options'

export type { ShippingOrder }

type Row = Record<string, unknown>
const rows = (value: unknown) => (Array.isArray(value) ? (value.filter(Boolean) as Row[]) : [])

/** The first fulfillment that was not canceled – the one that stands in the way of a shipment. */
export function activeFulfillment(
  order: ShippingOrder,
): ShippingOrder['fulfillments'][number] | null {
  return order.fulfillments.find((fulfillment) => !fulfillment.canceledAt) ?? null
}

/**
 * The order as shipping sees it: the shop's `resolveOrder` plus the parcel class of every item
 * (`resolveParcelClasses`, one question for all products of the order). `null` when there is no such order.
 */
export async function loadShippingOrder(
  container: MedusaContainer,
  orderId: string,
): Promise<ShippingOrder | null> {
  const source = await furgonetkaOptions(container).resolveOrder(container, orderId)
  if (!source) return null
  const productIds = [
    ...new Set(source.items.flatMap((item) => (item.productId ? [item.productId] : []))),
  ]
  const classes = await parcelClassesOf(container, productIds)
  return {
    ...source,
    items: source.items.map((item) => ({
      ...item,
      parcelClass: (item.productId && classes.get(item.productId)) || null,
    })),
  }
}

/**
 * The orders the shipping list has to load: shop orders still `pending` that have no active
 * (non-canceled) fulfillment, the oldest first. Medusa never moves an order from `pending` to
 * `completed` after delivery, so shipped orders stay `pending` for good – this cheap pre-filter
 * (two queries however many orders there are) keeps `loadShippingOrder`, which runs a workflow and
 * several queries, away from the shop's whole history. Whether a candidate is paid and not canceled
 * is decided on the loaded order; shipments of Furgonetka that already have a fulfillment come
 * from the shipment table instead.
 */
export async function pendingOrderIds(container: MedusaContainer): Promise<string[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: 'order',
    fields: ['id', 'created_at', 'canceled_at', 'fulfillments.id', 'fulfillments.canceled_at'],
    filters: { status: 'pending' },
    pagination: { order: { created_at: 'ASC' } },
  })
  const open = data.filter((order) => {
    if (order.canceled_at) return false
    // A fulfillment link can come back empty; only a real, non-canceled one stands in the way.
    return !rows(order.fulfillments).some((fulfillment) => !fulfillment.canceled_at)
  })
  if (!open.length) return []

  // A draft order made in the admin has no cart; it is never shipped through the list.
  const { data: links } = await query.graph({
    entity: 'order_cart',
    fields: ['order_id'],
    filters: { order_id: open.map((order) => order.id) },
  })
  const shop = new Set(links.map((link) => link.order_id))
  return open.filter((order) => shop.has(order.id)).map((order) => order.id)
}

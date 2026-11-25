import type { ShippingOrderSource } from '@cloud-house/medusa-furgonetka'
import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'

type Row = Record<string, unknown>

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null)
const cents = (value: unknown) => Math.round(Number(value ?? 0) * 100)
const date = (value: unknown) => (value ? new Date(value as string) : null)

/**
 * The test shop's `resolveOrder`: the order straight from the Order module. The delivery method
 * and the locker are read from the order's metadata (`delivery_code`, `locker`, `locker_label`),
 * the order counts as paid unless `metadata.paid === false`; a real shop reads its checkout here.
 */
export async function resolveOrder(
  container: MedusaContainer,
  orderId: string,
): Promise<ShippingOrderSource | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: 'order',
    fields: [
      'id',
      'display_id',
      'email',
      'created_at',
      'status',
      'canceled_at',
      'metadata',
      'item_total',
      'items.id',
      'items.title',
      'items.quantity',
      'items.product_id',
      'items.variant_title',
      'shipping_address.*',
      'fulfillments.id',
      'fulfillments.canceled_at',
      'fulfillments.shipped_at',
      'fulfillments.delivered_at',
      'customer.has_account',
    ],
    filters: { id: orderId },
  })
  const [order] = data as unknown as Row[]
  if (!order) return null
  const links = await query.graph({
    entity: 'order_cart',
    fields: ['cart_id'],
    filters: { order_id: orderId },
  })
  const metadata = (order.metadata ?? {}) as Row
  const place = (order.shipping_address ?? null) as Row | null
  const email = text(order.email)
  const firstName = text(place?.first_name) ?? ''
  const lastName = text(place?.last_name) ?? ''
  return {
    id: orderId,
    displayId: Number(order.display_id),
    createdAt: new Date(order.created_at as string),
    email,
    customerName: [firstName, lastName].filter(Boolean).join(' ') || (email ?? ''),
    shopOrder: links.data.length > 0,
    paid: metadata.paid !== false,
    canceled: order.status === 'canceled' || Boolean(order.canceled_at),
    hasAccount: Boolean((order.customer as Row | null)?.has_account),
    deliveryCode: text(metadata.delivery_code) ?? 'kurier-dpd',
    deliveryName: null,
    lockerCode: text(metadata.locker),
    lockerLabel: text(metadata.locker_label),
    address: place
      ? {
          firstName,
          lastName,
          company: text(place.company),
          address1: text(place.address_1),
          address2: text(place.address_2),
          postalCode: text(place.postal_code),
          city: text(place.city),
          phone: text(place.phone),
        }
      : null,
    items: ((order.items as Row[]) ?? []).map((item) => ({
      id: String(item.id),
      title: String(item.title),
      variant: text(item.variant_title),
      quantity: Number(item.quantity),
      productId: text(item.product_id),
    })),
    itemsTotalCents: cents(order.item_total),
    fulfillments: ((order.fulfillments as Row[]) ?? []).map((fulfillment) => ({
      id: String(fulfillment.id),
      canceledAt: date(fulfillment.canceled_at),
      shippedAt: date(fulfillment.shipped_at),
      deliveredAt: date(fulfillment.delivered_at),
    })),
  }
}

/** The test shop's contact. */
export const resolveContact = async () => ({
  email: 'contact@shop.test',
  phone: '+48 600 100 200',
  hours: 'pn–pt 9–16',
  seller: 'Test Shop sp. z o.o.',
})

import { type ReturnContact, type ReturnOrder, toReturnRow } from '@cloud-house/medusa-returns'
import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'

type Row = Record<string, unknown>

const num = (value: unknown) => Number(value ?? 0)
const date = (value: unknown) => (value ? new Date(value as string) : null)

/**
 * The test shop's `resolveOrder`: the order straight from the Order module, shipped lines read from
 * Medusa's own quantities. A real shop adds names, variants and thumbnails of its own catalogue.
 */
export async function resolveOrder(
  container: MedusaContainer,
  orderId: string,
): Promise<ReturnOrder | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: 'order',
    fields: [
      'id',
      'display_id',
      'email',
      'status',
      'canceled_at',
      'is_draft_order',
      'items.id',
      'items.title',
      'items.thumbnail',
      'items.detail.quantity',
      'items.detail.shipped_quantity',
      'items.detail.return_requested_quantity',
      'items.detail.return_received_quantity',
      'items.detail.return_dismissed_quantity',
      'fulfillments.shipped_at',
      'fulfillments.delivered_at',
      'fulfillments.canceled_at',
    ],
    filters: { id: orderId },
  })
  const [order] = data as unknown as Row[]
  if (!order) return null
  const [links, returns] = await Promise.all([
    query.graph({ entity: 'order_cart', fields: ['cart_id'], filters: { order_id: orderId } }),
    query.graph({
      entity: 'return',
      fields: [
        'id',
        'display_id',
        'order_id',
        'status',
        'requested_at',
        'received_at',
        'no_notification',
        'items.item_id',
        'items.quantity',
        'items.received_quantity',
        'items.note',
        'items.reason.value',
      ],
      filters: { order_id: orderId },
    }),
  ])
  return {
    id: String(order.id),
    displayId: num(order.display_id),
    email: (order.email as string | null) ?? null,
    shopOrder: links.data.length > 0 && !order.is_draft_order,
    canceled: order.status === 'canceled' || Boolean(order.canceled_at),
    items: ((order.items as Row[]) ?? []).map((item) => {
      const detail = (item.detail ?? {}) as Row
      return {
        id: String(item.id),
        title: String(item.title),
        variant: null,
        thumbnail: (item.thumbnail as string | null) ?? null,
        quantities: {
          quantity: num(detail.quantity),
          shipped: num(detail.shipped_quantity),
          requested: num(detail.return_requested_quantity),
          received: num(detail.return_received_quantity),
          dismissed: num(detail.return_dismissed_quantity),
        },
      }
    }),
    fulfillments: ((order.fulfillments as Row[]) ?? []).map((fulfillment) => ({
      shippedAt: date(fulfillment.shipped_at),
      deliveredAt: date(fulfillment.delivered_at),
      canceledAt: date(fulfillment.canceled_at),
    })),
    returns: (returns.data as Row[]).map(toReturnRow),
  }
}

/** The test shop's contact: a 14-day window and a return address. */
export const resolveContact = async (): Promise<ReturnContact> => ({
  email: 'contact@shop.test',
  phone: null,
  hours: null,
  seller: 'Test Shop sp. z o.o.',
  returnDays: 14,
  returnAddress: ['Test Shop – returns', 'ul. Portowa 3', '80-002 Gdańsk'],
})

import type { OrderReference, OrderSummary, OrderSummaryAddress } from '@cloud-house/commerce-rules'
import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { getOrderDetailWorkflow } from '@medusajs/medusa/core-flows'
import { adjustmentCodes, typedPromotionCodes } from './promotion-codes'
import { saleAmounts } from './sale-amounts'

const ADDRESS_FIELDS = [
  'first_name',
  'last_name',
  'company',
  'address_1',
  'address_2',
  'postal_code',
  'city',
  'country_code',
  'phone',
] as const

const ORDER_FIELDS = [
  'id',
  'display_id',
  'email',
  'created_at',
  'metadata',
  'item_total',
  'original_item_total',
  'shipping_total',
  'tax_total',
  'total',
  // Refunds booked as credit lines lower `total`; `saleAmounts` puts them back.
  'credit_line_total',
  'items.id',
  'items.variant_id',
  'items.title',
  'items.product_title',
  'items.product_handle',
  'items.variant_title',
  'items.thumbnail',
  'items.quantity',
  'items.total',
  'items.original_total',
  // What `saleAmounts` needs to put the pieces received back into the figures.
  'items.unit_price',
  'items.is_tax_inclusive',
  'items.tax_lines.rate',
  'items.return_received_total',
  'items.return_dismissed_total',
  'items.metadata',
  'items.adjustments.code',
  'shipping_methods.name',
  'shipping_methods.amount',
  'shipping_methods.total',
  'shipping_methods.data',
  'shipping_methods.shipping_option_id',
  ...ADDRESS_FIELDS.map((field) => `shipping_address.${field}`),
  ...ADDRESS_FIELDS.map((field) => `billing_address.${field}`),
]

export type Row = Record<string, unknown>

const num = (value: unknown) => Number(value ?? 0)
const text = (value: unknown) => (typeof value === 'string' ? value : null)
const record = (value: unknown) =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : null

function address(value: unknown): OrderSummaryAddress | null {
  const row = record(value)
  if (!row) return null
  return Object.fromEntries(ADDRESS_FIELDS.map((field) => [field, text(row[field])])) as Record<
    (typeof ADDRESS_FIELDS)[number],
    string | null
  >
}

async function optionCode(container: MedusaContainer, optionId: unknown) {
  if (typeof optionId !== 'string') return null
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: 'shipping_option',
    fields: ['type.code'],
    filters: { id: optionId },
  })
  return text(data[0]?.type?.code)
}

/**
 * Order for the confirmation page. Order ids end up in URLs, so personal data goes only to the
 * browser that holds the cart the order was placed from (spec 3b §4.7).
 */
export async function loadOrderSummary(
  container: MedusaContainer,
  orderId: string,
  cartId?: string,
): Promise<OrderSummary | OrderReference | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: 'order',
    fields: ['id', 'display_id'],
    filters: { id: orderId },
  })
  const [found] = orders
  if (!found) return null
  const reference: OrderReference = { id: found.id, display_id: Number(found.display_id) }
  if (!cartId) return reference

  const { data: links } = await query.graph({
    entity: 'order_cart',
    fields: ['order_id', 'cart_id'],
    filters: { order_id: orderId, cart_id: cartId },
  })
  if (!links.length) return reference

  return toOrderSummary(container, reference, await readOrderDetail(container, orderId))
}

/**
 * The shipping methods without the ones of return options. Medusa keeps the method of a return
 * (`order_shipping` with a `return_id`) beside the delivery, and the shop reads „the” delivery as
 * the first method – a return must never take its place (spec 6e-b §5.3).
 */
export function withoutReturnMethods(methods: Row[], returnOptionIds: Set<string>): Row[] {
  return methods.filter(
    (method) =>
      typeof method.shipping_option_id !== 'string' ||
      !returnOptionIds.has(method.shipping_option_id),
  )
}

/** Ids among `optionIds` of the shipping options with the rule `is_return: 'true'`. */
async function returnOptionIdsOf(container: MedusaContainer, optionIds: string[]) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: 'shipping_option',
    fields: ['id', 'rules.attribute', 'rules.value'],
    filters: { id: optionIds },
  })
  return new Set(
    (
      data as unknown as {
        id: string
        rules?: ({ attribute?: string; value?: unknown } | null)[]
      }[]
    )
      .filter((option) =>
        (option.rules ?? []).some(
          (rule) => rule?.attribute === 'is_return' && rule.value === 'true',
        ),
      )
      .map((option) => option.id),
  )
}

/**
 * The order row the confirmation view is built from; `extraFields` for the account view. An
 * order with one shipping method needs no further look; with more, the methods of return options
 * are dropped.
 */
export async function readOrderDetail(
  container: MedusaContainer,
  orderId: string,
  extraFields: string[] = [],
): Promise<Row> {
  const { result } = await getOrderDetailWorkflow(container).run({
    input: { order_id: orderId, fields: [...new Set([...ORDER_FIELDS, ...extraFields])] },
  })
  const order = result as unknown as Row
  const methods = Array.isArray(order.shipping_methods) ? (order.shipping_methods as Row[]) : []
  if (methods.length > 1) {
    const optionIds = methods
      .map((method) => method.shipping_option_id)
      .filter((id): id is string => typeof id === 'string')
    order.shipping_methods = withoutReturnMethods(
      methods,
      await returnOptionIdsOf(container, optionIds),
    )
  }
  return order
}

/**
 * The confirmation view of a full order row. The amounts are those of the sale: Medusa leaves the
 * pieces received back out of an order's and its lines' totals, the customer still paid for them
 * (`saleAmounts`). `readOrderDetail` itself returns Medusa's figures, the invoice adds the returned
 * share on its own.
 */
export async function toOrderSummary(
  container: MedusaContainer,
  reference: OrderReference,
  order: Row,
): Promise<OrderSummary> {
  const [method] = (order.shipping_methods ?? []) as Row[]
  const items = (order.items ?? []) as Row[]
  const codes = adjustmentCodes(items as Parameters<typeof adjustmentCodes>[0])
  const typed = await typedPromotionCodes(container, codes)
  const sale = saleAmounts(order)
  return {
    ...reference,
    email: text(order.email),
    created_at: new Date(order.created_at as string | Date).toISOString(),
    payment_status: String(order.payment_status ?? 'not_paid'),
    items: items.map((item, index) => ({
      id: item.id as string,
      variant_id: text(item.variant_id),
      title: String(item.title ?? ''),
      product_title: text(item.product_title),
      product_handle: text(item.product_handle),
      variant_title: text(item.variant_title),
      thumbnail: text(item.thumbnail),
      quantity: num(item.quantity),
      total: sale.lines[index]?.total ?? num(item.total),
      original_total: sale.lines[index]?.original_total ?? num(item.original_total),
      metadata: record(item.metadata),
    })),
    item_total: sale.item_total,
    original_item_total: sale.original_item_total,
    shipping_total: num(order.shipping_total),
    tax_total: sale.tax_total,
    total: sale.total,
    shipping_address: address(order.shipping_address),
    billing_address: address(order.billing_address),
    shipping_method: method
      ? {
          name: String(method.name ?? ''),
          code: await optionCode(container, method.shipping_option_id),
          amount: num(method.total ?? method.amount),
          data: record(method.data),
        }
      : null,
    metadata: record(order.metadata),
    codes: codes.filter((code) => typed.has(code)),
  }
}

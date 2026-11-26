import {
  DELIVERY_REVIEW_NOTES,
  type LineAdjustment,
  type OrderSummary,
  splitLineDiscount,
} from '@cloud-house/commerce-rules'
import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import type { OrderPlacedEmailData } from '../emails/types'
import type { CheckoutContact } from '../types'
import { orderNeedsCourier } from './delivery-review'
import { toOrderPlacedEmailData } from './order-email-data'
import { loadOrderSummary } from './order-summary'
import { checkoutPlOptions } from './plugin-options'
import { adjustmentCodes, typedPromotionCodes } from './promotion-codes'

type Env = Record<string, string | undefined>
type Logger = { warn(message: string): void }

type AdjustedItem = { id: string; adjustments?: (LineAdjustment | null)[] | null }

/** Reply-To of customer e-mails: the `replyToEnv` variable (default `EMAIL_REPLY_TO`), else the shop contact e-mail. */
export function replyToFor(
  env: Env,
  contact: CheckoutContact | null,
  replyToEnv = 'EMAIL_REPLY_TO',
): string | null {
  return env[replyToEnv] || contact?.email || null
}

/**
 * Line id → its discount split into the bundle (automatic promotions) and codes the customer
 * typed – a line can have both (a bundled paddle with a −10% code). The e-mail shows only the
 * label, so the parts need no `subtotal` (net amounts are not brought to gross).
 */
async function discountByItem(container: MedusaContainer, order: OrderSummary) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: 'order',
    fields: [
      'items.id',
      'items.adjustments.code',
      'items.adjustments.amount',
      'items.adjustments.is_tax_inclusive',
    ],
    filters: { id: order.id },
  })
  const items = ((data[0] as { items?: (AdjustedItem | null)[] } | undefined)?.items ?? []).flatMap(
    (item) => (item ? [item] : []),
  )
  const typed = await typedPromotionCodes(container, adjustmentCodes(items))
  const adjustments = new Map(items.map((item) => [item.id, item.adjustments ?? []]))
  return new Map(
    order.items.map((item) => [
      item.id,
      splitLineDiscount(
        {
          total: item.total,
          original_total: item.original_total,
          adjustments: adjustments.get(item.id),
        },
        (code) => typed.has(code),
      ),
    ]),
  )
}

/**
 * Everything the `order-placed` e-mail needs; `null` for an order not placed in the shop (no
 * `order_cart` link – e.g. entered in the admin) or without an e-mail address.
 */
export async function loadOrderPlacedEmail(
  container: MedusaContainer,
  orderId: string,
  env: Env,
  logger: Logger,
): Promise<{ to: string; data: OrderPlacedEmailData; replyTo: string | null } | null> {
  const { data: links } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: 'order_cart',
    fields: ['order_id', 'cart_id'],
    filters: { order_id: orderId },
  })
  const cartId = (links[0] as { cart_id?: string } | undefined)?.cart_id
  if (!cartId) return null
  const summary = await loadOrderSummary(container, orderId, cartId)
  if (!summary || !('email' in summary) || !summary.email) return null
  const order: OrderSummary = summary

  const options = checkoutPlOptions(container)
  const variantIds = [...new Set(order.items.flatMap((item) => item.variant_id ?? []))]
  const [labels, discounts, courier, contact] = await Promise.all([
    options.variantLabels
      ? options.variantLabels(container, variantIds)
      : Promise.resolve(new Map<string, string>()),
    discountByItem(container, order),
    orderNeedsCourier(container, orderId),
    options.resolveContact(container),
  ])
  const replyTo = replyToFor(env, contact, options.replyToEnv)
  return {
    to: order.email as string,
    replyTo,
    data: toOrderPlacedEmailData(order, {
      variantLabels: labels,
      discountByItem: discounts,
      deliveryNote: courier.review,
      contact,
      replyTo,
      shopUrl: env[options.storefrontUrlEnv] || 'http://localhost:3200',
      lockerCode: options.deliveryCodes.inpostLocker,
      reviewNotes: { ...DELIVERY_REVIEW_NOTES, ...options.deliveryReviewNotes },
      ...(options.groupLines ? { groupLines: options.groupLines } : {}),
    }),
  }
}

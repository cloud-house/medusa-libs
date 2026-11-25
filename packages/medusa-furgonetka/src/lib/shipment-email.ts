import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import type { ShipmentEmailData } from '../emails/types'
import { FURGONETKA_MODULE } from '../modules/furgonetka'
import type FurgonetkaModuleService from '../modules/furgonetka/service'
import type { Carrier, ShipmentReceiver, ShippingOrder } from '../types'
import { CARRIER_NAMES, carrierForCode, httpUrl, trackingUrl } from './carriers'
import { prefixedLogger } from './log'
import { furgonetkaOptions } from './plugin-options'
import { receiverOf } from './rows'
import { storefrontUrl } from './storefront-url'

type Env = Record<string, string | undefined>
type Row = Record<string, unknown>
type Label = { tracking_number?: string | null; tracking_url?: string | null } | null

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null)
const rows = (value: unknown) => (Array.isArray(value) ? (value.filter(Boolean) as Row[]) : [])
const lines = (values: (string | null)[]) => values.filter((line): line is string => Boolean(line))

/**
 * The parcel numbers of a shipped fulfillment. The link is the one on the label; the carrier's own
 * tracking page stands in when the label has none or only a placeholder (a manual „Mark as shipped”
 * with a bare number sends `#`).
 */
export function parcelNumbers(carrier: Carrier, labels: Label[] | null | undefined) {
  return (labels ?? []).flatMap((label) => {
    const number = text(label?.tracking_number)
    return number
      ? [{ number, url: httpUrl(label?.tracking_url) ?? trackingUrl(carrier, number) }]
      : []
  })
}

/** „Paczkomat {kod}” with its description, or the receiver with the address – from the shipment. */
export function destinationOfReceiver(
  receiver: ShipmentReceiver,
): ShipmentEmailData['destination'] {
  if (receiver.point) {
    return {
      title: `Paczkomat ${receiver.point}`,
      lines: lines([text(receiver.point_label)]),
    }
  }
  return {
    title: receiver.name,
    lines: lines([
      text(receiver.street),
      text([receiver.postal_code, receiver.city].filter(Boolean).join(' ')),
    ]),
  }
}

/** The same from the order, for a shipment entered by hand: the delivery method and the address. */
export function destinationOfOrder(
  order: Pick<ShippingOrder, 'deliveryCode' | 'lockerCode' | 'lockerLabel' | 'address'>,
  lockerCode: string,
): ShipmentEmailData['destination'] {
  if (order.deliveryCode === lockerCode) {
    return order.lockerCode
      ? { title: `Paczkomat ${order.lockerCode}`, lines: lines([text(order.lockerLabel)]) }
      : null
  }
  const address = order.address
  const name = text([address?.firstName, address?.lastName].filter(Boolean).join(' '))
  const place = lines([
    text(address?.address1),
    text(address?.address2),
    text([address?.postalCode, address?.city].filter(Boolean).join(' ')),
  ])
  return name ? { title: name, lines: place } : null
}

/** The order a fulfillment belongs to (the `order_fulfillment` link); `null` for an unknown one. */
export async function orderIdOfFulfillment(
  container: MedusaContainer,
  fulfillmentId: string,
): Promise<string | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: 'order_fulfillment',
    fields: ['order_id', 'fulfillment_id'],
    filters: { fulfillment_id: fulfillmentId },
  })
  return (data[0] as { order_id?: string } | undefined)?.order_id ?? null
}

/** What the fulfillment ships: line id → quantity, or `null` when it lists no items. */
function fulfilledQuantities(items: Row[]): Map<string, number> | null {
  const quantities = new Map<string, number>()
  for (const item of items) {
    const line = text(item.line_item_id)
    // A line can appear once per inventory item of a kit – the first quantity is the line's.
    if (line && !quantities.has(line)) quantities.set(line, Number(item.quantity ?? 0))
  }
  return quantities.size ? quantities : null
}

/** The shop's contact; a resolver that fails counts as no contact (the e-mail goes without it). */
async function contactOf(container: MedusaContainer, displayId: number) {
  try {
    return (await furgonetkaOptions(container).resolveContact?.(container)) ?? null
  } catch (error) {
    prefixedLogger(container).warn(
      `Kontakt sklepu niedostępny – e-mail bez danych kontaktowych (zamówienie #${displayId}): ${error instanceof Error ? error.message : String(error)}`,
    )
    return null
  }
}

/**
 * Everything the `shipment` e-mail needs (spec 6d §5.8) for the fulfillment that was just marked
 * as shipped; `null` for an order not placed in the shop (`shopOrder`) or without an e-mail
 * address. A furgonetka shipment row, when there is one, tells the carrier and the destination; a
 * shipment marked by hand takes them from the order.
 */
export async function loadShipmentEmail(
  container: MedusaContainer,
  fulfillmentId: string,
  env: Env,
): Promise<{
  to: string
  orderId: string
  data: ShipmentEmailData
  replyTo: string | null
} | null> {
  const options = furgonetkaOptions(container)
  const orderId = await orderIdOfFulfillment(container, fulfillmentId)
  if (!orderId) return null
  const order = await options.resolveOrder(container, orderId)
  if (!order?.shopOrder) return null
  const to = text(order.email)
  if (!to) return null

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const [fulfillments, shipment] = await Promise.all([
    query.graph({
      entity: 'fulfillment',
      fields: [
        'id',
        'labels.tracking_number',
        'labels.tracking_url',
        'items.line_item_id',
        'items.quantity',
      ],
      filters: { id: fulfillmentId },
    }),
    container
      .resolve<FurgonetkaModuleService>(FURGONETKA_MODULE)
      .shipmentByFulfillment(fulfillmentId),
  ])
  const fulfillment = fulfillments.data[0] as Row | undefined
  const carrier: Carrier =
    shipment?.carrier ?? carrierForCode(order.deliveryCode, options.deliveryCodes)

  const fulfilled = fulfilledQuantities(rows(fulfillment?.items))
  const items = order.items.flatMap((item) => {
    const quantity = fulfilled ? fulfilled.get(item.id) : item.quantity
    if (!quantity) return []
    // The same name the invoice shows: product, then the variant label.
    return [{ name: item.variant ? `${item.title} – ${item.variant}` : item.title, quantity }]
  })

  const contact = await contactOf(container, order.displayId)
  const replyTo = env.EMAIL_REPLY_TO || contact?.replyTo || contact?.email || null
  const shopUrl = storefrontUrl(env)
  return {
    to,
    orderId,
    replyTo,
    data: {
      displayId: order.displayId,
      carrier: CARRIER_NAMES[carrier],
      parcels: parcelNumbers(carrier, rows(fulfillment?.labels) as Label[]),
      destination: shipment
        ? destinationOfReceiver(receiverOf(shipment))
        : destinationOfOrder(order, options.deliveryCodes.inpostLocker),
      items,
      accountUrl: order.hasAccount
        ? `${shopUrl}${options.accountOrderPath.replace(':id', orderId)}`
        : null,
      shopUrl,
      contact: {
        canReply: Boolean(replyTo),
        email: contact?.email ?? null,
        phone: contact?.phone ?? null,
        hours: contact?.hours ?? null,
      },
    },
  }
}

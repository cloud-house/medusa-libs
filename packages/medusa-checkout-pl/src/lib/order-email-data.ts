import {
  type DeliveryReview,
  type LineDiscountParts,
  lineDiscountLabel,
  type OrderSummary,
  type OrderSummaryAddress,
  type OrderSummaryItem,
} from '@cloud-house/commerce-rules'
import type { EmailLine, OrderPlacedEmailData } from '../emails/types'
import type { LineGroup } from '../options'
import type { CheckoutContact } from '../types'

/** What the order summary does not know: catalog labels, promotion codes, shop settings. */
export interface OrderPlacedExtras {
  /** Variant id → „Turkus · 10'6"” (colour, then size; „Standard” left out). */
  variantLabels: Map<string, string>
  /** Line id → its discount split into the bundle and typed codes (missing: the bundle). */
  discountByItem: Map<string, LineDiscountParts>
  /** Why the delivery will differ from the order (`delivery_review`); `null` – it will not. */
  deliveryNote: DeliveryReview | null
  contact: CheckoutContact | null
  replyTo: string | null
  shopUrl: string
  /** Code of the parcel locker delivery method. */
  lockerCode: string
  /** Notes for a reviewed delivery. */
  reviewNotes: Record<DeliveryReview, string>
  /** Groups the lines; default every line on its own. */
  groupLines?: (items: OrderSummaryItem[]) => LineGroup<OrderSummaryItem>[]
}

export const HIDDEN_VARIANT = 'Standard'
/** A discounted line without a known split is named as the bundle discount. */
const UNKNOWN_SPLIT: LineDiscountParts = { bundle: 0, code: 0, codes: [] }
const DATE = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Warsaw',
})
const round = (value: number) => Math.round(value * 100) / 100
const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null)

/** `+48600100200` → `+48 600 100 200`; other numbers as they are. */
function phone(value: string | null): string | null {
  const match = value ? /^\+48(\d{3})(\d{3})(\d{3})$/.exec(value) : null
  return match ? `+48 ${match[1]} ${match[2]} ${match[3]}` : value
}

function addressLines(address: OrderSummaryAddress | null): string[] {
  if (!address) return []
  return [
    text(address.address_1),
    text(address.address_2),
    text([address.postal_code, address.city].filter(Boolean).join(' ')),
  ].filter((line): line is string => Boolean(line))
}

const flat = <T>(items: T[]): LineGroup<T>[] => items.map((line) => ({ line, upgrades: [] }))

function emailLine(item: OrderSummaryItem, extras: OrderPlacedExtras): EmailLine {
  const fallback = item.variant_title === HIDDEN_VARIANT ? null : text(item.variant_title)
  const replaces = item.metadata?.replaces
  return {
    title: item.product_title ?? item.title,
    variant: (item.variant_id && extras.variantLabels.get(item.variant_id)) || fallback,
    thumbnail: item.thumbnail,
    quantity: item.quantity,
    total: item.total,
    originalTotal: item.original_total,
    discountLabel:
      item.original_total > item.total
        ? lineDiscountLabel(extras.discountByItem.get(item.id) ?? UNKNOWN_SPLIT)
        : null,
    replaces: typeof replaces === 'string' ? replaces : null,
  }
}

function delivery(
  order: OrderSummary,
  deliveryNote: DeliveryReview | null,
  lockerCode: string,
  reviewNotes: Record<DeliveryReview, string>,
): OrderPlacedEmailData['delivery'] {
  const method = order.shipping_method
  if (!method) return null
  const note = deliveryNote ? reviewNotes[deliveryNote] : null
  if (method.code === lockerCode) {
    const code = text(method.data?.parcel_locker)
    return {
      method: method.name,
      lines: [code ? `Paczkomat ${code}` : null, text(method.data?.parcel_locker_label)].filter(
        (line): line is string => Boolean(line),
      ),
      note,
    }
  }
  const address = order.shipping_address
  const tel = phone(text(address?.phone))
  return {
    method: method.name,
    lines: [
      text([address?.first_name, address?.last_name].filter(Boolean).join(' ')),
      ...addressLines(address),
      tel ? `tel. ${tel}` : null,
    ].filter((line): line is string => Boolean(line)),
    note,
  }
}

/** Order summary (the same one as on the confirmation page) as data for the `order-placed` e-mail. */
export function toOrderPlacedEmailData(
  order: OrderSummary,
  extras: OrderPlacedExtras,
): OrderPlacedEmailData {
  const company = text(order.billing_address?.company)
  const nip = text(order.metadata?.nip)
  return {
    displayId: order.display_id,
    placedAt: DATE.format(new Date(order.created_at)),
    firstName: text(order.shipping_address?.first_name),
    groups: (extras.groupLines ?? flat)(order.items).map(({ line, upgrades }) => ({
      // An upgrade on its own (its board is not in the order) replaces nothing in a kit.
      line: { ...emailLine(line, extras), replaces: null },
      upgrades: upgrades.map((upgrade) => emailLine(upgrade, extras)),
    })),
    totals: {
      products: order.original_item_total,
      discounts: round(order.original_item_total - order.item_total),
      shipping: order.shipping_total,
      shippingMethod: order.shipping_method?.name ?? 'Dostawa',
      total: order.total,
      tax: order.tax_total,
    },
    delivery: delivery(order, extras.deliveryNote, extras.lockerCode, extras.reviewNotes),
    invoice: company || nip ? { company, nip, lines: addressLines(order.billing_address) } : null,
    customerNote: text(order.metadata?.customer_note),
    contact: {
      canReply: Boolean(extras.replyTo),
      email: extras.contact?.email ?? null,
      phone: extras.contact?.phone ?? null,
      hours: extras.contact?.hours ?? null,
    },
    seller: extras.contact?.seller ?? null,
    shopUrl: extras.shopUrl,
  }
}

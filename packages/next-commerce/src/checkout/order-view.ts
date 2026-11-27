import {
  type DeliveryReview,
  deliveryReviewOf,
  type OrderSummary,
  type OrderSummaryAddress,
} from '@cloud-house/commerce-rules'
import {
  type CartGroupView,
  groupLines,
  type LineSource,
  type LineViewOptions,
  toLineView,
  type VariantOptions,
} from '../cart/view'
import { PARCEL_LOCKER_CODE } from './form'

export interface OrderView {
  id: string
  displayId: number
  email: string | null
  /** Płatność pobrana (`captured`) albo potwierdzona (`authorized`); inaczej czekamy na Stripe. */
  paid: boolean
  groups: CartGroupView[]
  originalItemTotal: number
  /** Wszystkie rabaty razem – zamówienie nie zapisuje, który był zestawowy, a który z kodu. */
  discount: number
  shippingTotal: number
  taxTotal: number
  total: number
  delivery: { name: string; lines: string[] } | null
  invoice: { company: string; nip: string | null; lines: string[] } | null
  /**
   * Flaga `delivery_review`: duży produkt w zamówieniu do paczkomatu (część pojedzie kurierem
   * pod adres) albo z Kurierem InPost (produkt „Tylko kurier” pojedzie kurierem DPD).
   */
  deliveryReview: DeliveryReview | null
  /** „Uwagi do zamówienia” z kasy (`metadata.customer_note`). */
  customerNote: string | null
  /** Kody wpisane przez klienta – kupon w zdarzeniu zakupu (spec 6b §5.5). */
  codes: string[]
}

const PAID = new Set(['captured', 'authorized'])
const round = (value: number) => Math.round(value * 100) / 100
const text = (value: unknown) => (typeof value === 'string' && value ? value : null)

function addressLines(address: OrderSummaryAddress | null): string[] {
  if (!address) return []
  return [
    address.address_1,
    address.address_2,
    [address.postal_code, address.city].filter(Boolean).join(' '),
  ].filter((line): line is string => Boolean(line))
}

function delivery(order: OrderSummary): OrderView['delivery'] {
  const method = order.shipping_method
  if (!method) return null
  if (method.code === PARCEL_LOCKER_CODE) {
    const code = text(method.data?.parcel_locker)
    const label = text(method.data?.parcel_locker_label)
    return {
      name: method.name,
      lines: [code ? `Paczkomat ${code}` : null, label].filter((l): l is string => Boolean(l)),
    }
  }
  const address = order.shipping_address
  const name = [address?.first_name, address?.last_name].filter(Boolean).join(' ')
  return {
    name: method.name,
    lines: [
      name || null,
      ...addressLines(address),
      address?.phone ? `tel. ${address.phone}` : null,
    ].filter((l): l is string => Boolean(l)),
  }
}

/** Zamówienie dla strony potwierdzenia: pozycje pogrupowane jak w koszyku (spec 3b §5.5). */
export function toOrderView(
  order: OrderSummary,
  variants: VariantOptions,
  options: LineViewOptions = {},
): OrderView {
  const company = text(order.billing_address?.company)
  const nip = text(order.metadata?.nip)
  return {
    id: order.id,
    displayId: order.display_id,
    email: order.email,
    paid: PAID.has(order.payment_status),
    groups: groupLines(
      order.items as LineSource[],
      (item) => toLineView(item, variants, () => ({ label: 'Rabat', code: 0 }), options),
      options.groupLines,
    ),
    originalItemTotal: order.original_item_total,
    discount: round(order.original_item_total - order.item_total),
    shippingTotal: order.shipping_total,
    taxTotal: order.tax_total,
    total: order.total,
    delivery: delivery(order),
    invoice:
      company || nip
        ? { company: company ?? '', nip, lines: addressLines(order.billing_address) }
        : null,
    deliveryReview: deliveryReviewOf(order.metadata?.delivery_review),
    customerNote: text(order.metadata?.customer_note),
    codes: order.codes,
  }
}

import type { InvoiceOrder } from '../types'
import { type InvoicePayload, type InvoicePosition, toCents } from './client'
import type { FakturowniaConfig } from './config'

export { toCents }

export type BuyerKind = 'company' | 'person'

/** Fakturownia's limit for a position name (KSeF guide of the API). */
const MAX_NAME = 256

/** The order cannot become an invoice – retrying will not help (spec 6c §5.3, §5.6). */
export class InvoiceMappingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvoiceMappingError'
  }
}

/** A NIP in the order means a company invoice; otherwise the invoice is for a private person. */
export function buyerKind(order: Pick<InvoiceOrder, 'nip'>): BuyerKind {
  return order.nip ? 'company' : 'person'
}

/** Fakturownia's payment type for a Medusa provider; free text is allowed (BLIK, Przelewy24). */
export function paymentType(
  providerId: string | null,
  paymentTypes: Record<string, string> = {},
): string {
  return (providerId && paymentTypes[providerId]) || 'transfer'
}

const WARSAW_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Warsaw',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** `YYYY-MM-DD` of the day in Warsaw. */
export function warsawDate(value: Date): string {
  return WARSAW_DATE.format(value)
}

/** Grosze → Fakturownia's amount in zł with a dot. */
export const zl = (cents: number) => (cents / 100).toFixed(2)
/** A position name within Fakturownia's limit. */
export const cut = (name: string) => name.slice(0, MAX_NAME)

/** The VAT rate of a position; a position without one cannot be invoiced. */
export function rate(name: string, value: number | null): number {
  if (value === null) throw new InvoiceMappingError(`Pozycja „${name}” nie ma stawki VAT.`)
  return value
}

/** The buyer block of an invoice or a credit note (spec 6c §5.3). */
export function buyerFields(order: InvoiceOrder): Record<string, string> {
  const { billing } = order
  const fullName = [billing.firstName, billing.lastName].filter(Boolean).join(' ')
  const address = {
    buyer_street: [billing.address1, billing.address2].filter(Boolean).join(' '),
    buyer_post_code: billing.postalCode,
    buyer_city: billing.city,
  }
  if (buyerKind(order) === 'company') {
    return {
      buyer_company: '1',
      buyer_name: billing.company ?? fullName,
      buyer_tax_no: order.nip ?? '',
      ...address,
    }
  }
  return {
    buyer_company: '0',
    buyer_name: fullName,
    buyer_first_name: billing.firstName,
    buyer_last_name: billing.lastName,
    ...address,
  }
}

/**
 * The paid VAT invoice of an order (spec 6c §5.3): unit prices before the discount, the line
 * discount as a gross amount, paid delivery as its own position, no phone number.
 */
export function toInvoicePayload(
  order: InvoiceOrder,
  config: Pick<FakturowniaConfig, 'oidPrefix' | 'departmentId'>,
  today: Date,
  paymentTypes: Record<string, string> = {},
): InvoicePayload {
  const positions: InvoicePosition[] = order.items.map((item) => {
    const discount = item.unitPriceCents * item.quantity - item.totalCents
    return {
      name: cut(item.name),
      ...(item.sku ? { code: item.sku } : {}),
      quantity: item.quantity,
      quantity_unit: 'szt.',
      tax: rate(item.name, item.taxRate),
      price_gross: zl(item.unitPriceCents),
      ...(discount > 0 ? { discount: zl(discount) } : {}),
    }
  })
  if (order.shipping && order.shipping.totalCents > 0) {
    const name = cut(`Dostawa – ${order.shipping.name}`)
    positions.push({
      name,
      quantity: 1,
      quantity_unit: 'szt.',
      tax: rate(name, order.shipping.taxRate),
      price_gross: zl(order.shipping.totalCents),
    })
  }
  const paidDay = warsawDate(order.paidAt ?? order.createdAt)
  return {
    kind: 'vat',
    currency: 'PLN',
    lang: 'pl',
    oid: `${config.oidPrefix}${order.displayId}`,
    oid_unique: 'yes',
    issue_date: warsawDate(today),
    sell_date: paidDay,
    payment_to: paidDay,
    paid_date: paidDay,
    status: 'paid',
    paid: zl(order.totalCents),
    payment_type: paymentType(order.providerId, paymentTypes),
    show_discount: '1',
    discount_kind: 'amount',
    ...(config.departmentId ? { department_id: config.departmentId } : {}),
    ...buyerFields(order),
    buyer_email: order.email,
    buyer_country: 'PL',
    positions,
  }
}

/** Gross total of the payload in grosze – what Fakturownia should read back. */
export function payloadTotalCents(payload: InvoicePayload): number {
  return payload.positions.reduce(
    (sum, position) =>
      sum + toCents(position.price_gross) * position.quantity - toCents(position.discount ?? 0),
    0,
  )
}

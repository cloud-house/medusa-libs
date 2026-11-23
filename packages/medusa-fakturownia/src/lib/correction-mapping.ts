import type { InvoiceOrder } from '../types'
import {
  type CorrectionPayload,
  type CorrectionPosition,
  type CorrectionSide,
  toCents,
} from './client'
import type { FakturowniaConfig } from './config'
import { buyerFields, cut, InvoiceMappingError, rate, warsawDate, zl } from './mapping'

/** The reason Fakturownia prints on every credit note of a return. */
export const CORRECTION_REASON = 'Zwrot towaru – odstąpienie od umowy'

/**
 * What the customer paid for `units` of a line of `quantity` pieces that cost `totalCents`
 * together (after discounts). Before and after a correction are both read from it, so the notes of
 * one line always add up to the line total, whatever the rounding of a single piece.
 */
export function paidFor(totalCents: number, quantity: number, units: number): number {
  return Math.round((totalCents * units) / quantity)
}

/** Pieces of order lines: `itemId` is the order line id. */
type Pieces = { itemId: string; quantity: number }[]

export interface CorrectionInput {
  order: InvoiceOrder
  /** The invoice being corrected (its Fakturownia id). */
  invoiceFakturowniaId: string
  returnDisplayId: number
  /** What this return brings back. */
  returned: Pieces
  /** What earlier credit notes of the order already took off the invoice. */
  corrected: Pieces
  /** Whether this note also gives back the delivery (D4: once, with the whole order back). */
  shipping: boolean
}

const piecesOf = (pieces: Pieces, itemId: string) =>
  pieces.reduce((sum, piece) => (piece.itemId === itemId ? sum + piece.quantity : sum), 0)

function position(
  name: string,
  tax: string,
  before: { quantity: number; cents: number },
  after: { quantity: number; cents: number },
): CorrectionPosition {
  const side = (
    state: { quantity: number; cents: number },
    kind: CorrectionSide['kind'],
  ): CorrectionSide => ({
    name,
    quantity: String(state.quantity),
    total_price_gross: zl(state.cents),
    tax,
    kind,
  })
  return {
    name,
    quantity: after.quantity - before.quantity,
    total_price_gross: zl(after.cents - before.cents),
    tax,
    kind: 'correction',
    correction_before_attributes: side(before, 'correction_before'),
    correction_after_attributes: side(after, 'correction_after'),
  }
}

/**
 * The credit note of a return (spec 6e-b, D3, D4): every returned line goes from what is left on
 * the invoice to that minus the returned pieces, at the price actually paid; the delivery goes to
 * zero when `shipping` says so. The field names follow the README of `fakturownia/api` – an
 * assumption until the live check, kept in this one function.
 */
export function toCorrectionPayload(
  input: CorrectionInput,
  config: Pick<FakturowniaConfig, 'oidPrefix' | 'departmentId'>,
  today: Date,
): CorrectionPayload {
  const { order } = input
  const positions = input.returned.map(({ itemId, quantity: returned }) => {
    const item = order.items.find((line) => line.id === itemId)
    if (!item) throw new InvoiceMappingError(`Pozycja zwrotu ${itemId} nie należy do zamówienia.`)
    const name = cut(item.name)
    const tax = String(rate(item.name, item.taxRate))
    const left = item.quantity - piecesOf(input.corrected, itemId)
    if (returned > left) {
      throw new InvoiceMappingError(
        `Zwrot obejmuje więcej sztuk „${item.name}” niż zostało na fakturze.`,
      )
    }
    const paid = (units: number) => paidFor(item.totalCents, item.quantity, units)
    return position(
      name,
      tax,
      { quantity: left, cents: paid(left) },
      { quantity: left - returned, cents: paid(left - returned) },
    )
  })
  if (input.shipping && order.shipping && order.shipping.totalCents > 0) {
    const name = cut(`Dostawa – ${order.shipping.name}`)
    positions.push(
      position(
        name,
        String(rate(name, order.shipping.taxRate)),
        { quantity: 1, cents: order.shipping.totalCents },
        { quantity: 0, cents: 0 },
      ),
    )
  }
  return {
    kind: 'correction',
    invoice_id: input.invoiceFakturowniaId,
    from_invoice_id: input.invoiceFakturowniaId,
    correction_reason: CORRECTION_REASON,
    oid: `${config.oidPrefix}${order.displayId}-Z${input.returnDisplayId}`,
    oid_unique: 'yes',
    issue_date: warsawDate(today),
    currency: 'PLN',
    lang: 'pl',
    ...(config.departmentId ? { department_id: config.departmentId } : {}),
    ...buyerFields(order),
    buyer_email: order.email,
    buyer_country: 'PL',
    positions,
  }
}

/** Gross total of the credit note in grosze – negative for a return. */
export function correctionTotalCents(payload: CorrectionPayload): number {
  return payload.positions.reduce((sum, position) => sum + toCents(position.total_price_gross), 0)
}

/** Every piece of the order came back – received or received damaged (`dismissed`). */
export function wholeOrderReturned(
  items: { quantity: number; received: number; dismissed: number }[],
): boolean {
  return items.every((item) => item.received + item.dismissed >= item.quantity)
}

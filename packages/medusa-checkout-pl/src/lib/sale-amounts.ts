/**
 * Amounts of a sale, whatever happened to it afterwards.
 *
 * Medusa 2.21.2 (`decorateCartTotals`, `getLineItemTotals` in `@medusajs/utils`) computes `total`,
 * `original_total`, `item_total`, `original_item_total` and `tax_total` of an order and of its
 * lines only for the pieces NOT received back (`return_received_quantity`) or dismissed
 * (`return_dismissed_quantity`). Medusa exposes the returned share of the gross amount – discounts
 * and VAT included – in `return_received_total` and `return_dismissed_total` (per line and summed
 * on the order). What the customer paid is the sum of both.
 *
 * Medusa also lowers the `total` of an ORDER by its credit lines (`total = subtotal + tax −
 * discount − credit_line_total`). `refundPaymentWorkflow` books one for every part of a refund
 * above what Medusa counts as owed – on a full return that is the delivery, which a return never
 * takes off the order. Credit lines are order-level only: they are added back to the order total,
 * never to a line, an item total or the VAT (they carry no tax lines).
 */

export type SaleRow = Record<string, unknown>

/** The amounts of an order or a line that a total depends on. */
export interface SaleShare {
  total?: unknown
  return_received_total?: unknown
  return_dismissed_total?: unknown
  /** Order level only – the refunds Medusa booked as credit lines; a line has none. */
  credit_line_total?: unknown
}

const num = (value: unknown) => Number(value ?? 0)
const rows = (value: unknown): SaleRow[] =>
  Array.isArray(value)
    ? value.map((row) => (row && typeof row === 'object' ? (row as SaleRow) : {}))
    : []

/** Rounded to the grosz: the amounts are zł, not grosze. */
const round = (value: number) => Math.round(value * 100) / 100

/** The gross share of the pieces received back or dismissed, which Medusa leaves out of `total`. */
export function returnedShare(row: SaleShare): number {
  return num(row.return_received_total) + num(row.return_dismissed_total)
}

/** The refunds Medusa booked as credit lines of an order, which it takes off `total`. */
export function creditedShare(row: SaleShare): number {
  return num(row.credit_line_total)
}

/**
 * The gross amount of the sale of an order or a line: `total` with the returned share and the
 * credit lines added back. Not rounded – callers round to their unit (the invoice to grosze).
 */
export function saleTotal(row: SaleShare): number {
  return num(row.total) + returnedShare(row) + creditedShare(row)
}

/**
 * What the customer paid for an order, for views that show only the total: Medusa's `total` when
 * nothing came back and nothing was credited, else with both added back, rounded to the grosz.
 */
export function paidTotal(row: SaleShare): number {
  return returnedShare(row) || creditedShare(row) ? round(saleTotal(row)) : num(row.total)
}

/** Sum of the tax line rates in percent (one 23% line today); 0 for a line without a tax line. */
function taxRate(item: SaleRow): number {
  return rows(item.tax_lines).reduce((sum, line) => sum + num(line.rate), 0)
}

/**
 * Gross price of one piece before discounts, as Medusa's `original_total` has it: the unit price of
 * a tax-inclusive line (the shop's prices all are), the unit price plus VAT otherwise.
 */
function listPrice(item: SaleRow): number {
  const price = num(item.unit_price)
  return item.is_tax_inclusive === false ? price * (1 + taxRate(item) / 100) : price
}

export interface SaleAmounts {
  /** `total` and `original_total` of each line, in the order of `order.items`. */
  lines: { total: number; original_total: number }[]
  item_total: number
  original_item_total: number
  tax_total: number
  total: number
}

/**
 * The figures of an order as they were when the customer paid: lines and totals with the returned
 * pieces put back (also when they are all back). Shipping is not touched – a return does not
 * return it. An order with nothing received back keeps Medusa's figures exactly; otherwise the
 * recalculated ones are rounded to the grosz. The order `total` also gets the credit lines
 * (`credit_line_total`) back; nothing else depends on them.
 *
 * Needs the order row with `credit_line_total`, `items.unit_price`, `items.is_tax_inclusive`,
 * `items.tax_lines.rate`, `items.return_received_total` and `items.return_dismissed_total`.
 */
export function saleAmounts(order: SaleRow): SaleAmounts {
  let share = 0
  let originalDelta = 0
  let taxShare = 0
  const lines = rows(order.items).map((item) => {
    const itemShare = returnedShare(item)
    if (!itemShare) return { total: num(item.total), original_total: num(item.original_total) }

    const rate = taxRate(item)
    const original = listPrice(item) * num(item.quantity)
    share += itemShare
    originalDelta += original - num(item.original_total)
    // The returned share is gross: its VAT is the part of it that `rate` percent of the net is.
    taxShare += (itemShare * rate) / (100 + rate)
    return { total: round(num(item.total) + itemShare), original_total: round(original) }
  })
  const put = (value: unknown, delta: number) => (share ? round(num(value) + delta) : num(value))
  const credited = creditedShare(order)
  const total = share || credited ? round(num(order.total) + share + credited) : num(order.total)

  return {
    lines,
    item_total: put(order.item_total, share),
    original_item_total: put(order.original_item_total, originalDelta),
    tax_total: put(order.tax_total, taxShare),
    total,
  }
}

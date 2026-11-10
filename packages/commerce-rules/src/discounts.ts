/** Price adjustment of a cart or order line (Medusa `items.adjustments`). */
export interface LineAdjustment {
  code?: string | null
  amount?: unknown
  /** `false` – Medusa stored the amount net of VAT. */
  is_tax_inclusive?: boolean | null
}

/** Line of a cart or an order – only what splitting its discount needs. */
export interface DiscountedLine {
  total?: unknown
  original_total?: unknown
  /** Net amount before discounts; turns net adjustment amounts into gross ones. */
  subtotal?: unknown
  adjustments?: (LineAdjustment | null)[] | null
}

/** Gross discount of one line by source. */
export interface LineDiscountParts {
  /** From automatic promotions (the bundle discount). */
  bundle: number
  /** From codes the customer typed. */
  code: number
  /** The typed codes on the line. */
  codes: string[]
}

const num = (value: unknown) => {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}
const round = (value: number) => Math.round(value * 100) / 100

/**
 * Splits the line's real discount (`original_total − total`) between the bundle and typed codes in
 * the proportion of the adjustments, each brought to gross (`original_total / subtotal` for net
 * ones) – a line can have both, e.g. a bundled paddle with a −10% code. The parts always add up to
 * the line's discount. Without amounts a typed code takes it all.
 */
export function splitLineDiscount(
  line: DiscountedLine,
  isTyped: (code: string) => boolean,
): LineDiscountParts {
  const original = num(line.original_total)
  const discount = round(Math.max(0, original - num(line.total)))
  if (!discount) return { bundle: 0, code: 0, codes: [] }

  const subtotal = num(line.subtotal)
  const toGross = subtotal > 0 ? original / subtotal : 1
  let typedGross = 0
  let otherGross = 0
  const codes: string[] = []
  for (const adjustment of line.adjustments ?? []) {
    if (!adjustment) continue
    const gross = num(adjustment.amount) * (adjustment.is_tax_inclusive ? 1 : toGross)
    if (adjustment.code && isTyped(adjustment.code)) {
      typedGross += gross
      if (!codes.includes(adjustment.code)) codes.push(adjustment.code)
    } else {
      otherGross += gross
    }
  }
  const all = typedGross + otherGross
  const code = all > 0 ? round((discount * typedGross) / all) : codes.length ? discount : 0
  return { bundle: round(discount - code), code, codes }
}

/** „Rabat zestawowy”, „Kod WIOSNA10” or both – how the shop and the e-mail name a line's discount. */
export function lineDiscountLabel(parts: LineDiscountParts): string {
  const codes = parts.codes.join(', ')
  if (parts.code > 0 && parts.bundle > 0) return `Rabat zestawowy + kod ${codes}`
  if (parts.code > 0) return `Kod ${codes}`
  return 'Rabat zestawowy'
}

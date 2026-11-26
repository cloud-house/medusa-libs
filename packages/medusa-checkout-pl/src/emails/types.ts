/** One order line as shown in an e-mail – amounts are gross, formatted by the template. */
export interface EmailLine {
  title: string
  /** Colour and size, e.g. „Turkus · 10'6"”; `null` when the product has no options to show. */
  variant: string | null
  thumbnail: string | null
  quantity: number
  total: number
  /** Amount before promotions; higher than `total` when `discountLabel` is set. */
  originalTotal: number
  discountLabel: string | null
  /** Kit item the upgrade replaces („zamiast …”). */
  replaces: string | null
}

/** A board with the upgrades bought for it (or any other line with no upgrades). */
export interface EmailLineGroup {
  line: EmailLine
  upgrades: EmailLine[]
}

/** `canReply` – a Reply-To address is known, so „Odpowiedz na tego maila” makes sense. */
export interface EmailContact {
  canReply: boolean
  email: string | null
  phone: string | null
  hours: string | null
}

/** Ready-to-show data of the order confirmation e-mail (spec 3c §4.3) – the template queries nothing. */
export interface OrderPlacedEmailData {
  displayId: number
  /** Already formatted in Polish, e.g. „19 października 2026”. */
  placedAt: string
  firstName: string | null
  groups: EmailLineGroup[]
  totals: {
    products: number
    discounts: number
    shipping: number
    shippingMethod: string
    total: number
    tax: number
  }
  delivery: { method: string; lines: string[]; note: string | null } | null
  invoice: { company: string | null; nip: string | null; lines: string[] } | null
  /** „Uwagi do zamówienia” from the checkout (`order.metadata.customer_note`), `null` – none. */
  customerNote: string | null
  contact: EmailContact
  /** Seller line for the footer („Sprzedawca: …”); `null` while the seller data is incomplete. */
  seller: string | null
  shopUrl: string
}

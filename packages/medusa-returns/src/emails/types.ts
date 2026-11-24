/** `canReply` – a Reply-To address is known, so „Odpowiedz na tego maila” makes sense. */
export interface EmailContact {
  canReply: boolean
  email: string | null
  phone: string | null
  hours: string | null
}

/** One returned order line as shown in the return e-mails; `reason` is the reason's label. */
export interface ReturnEmailLine {
  name: string
  /** Colour and size, e.g. „Turkus · 10'6"”; `null` when the product has no options to show. */
  variant: string | null
  quantity: number
  reason: string | null
}

/**
 * The customer's „we have your return” e-mail (spec 6e-b §5.5). `address` is where the goods go
 * back, `null` while the CMS has none (the e-mail then asks the customer to write first);
 * `accountUrl` is `null` for a guest order.
 */
export interface ReturnRequestedEmailData {
  displayId: number
  returnNumber: number
  items: ReturnEmailLine[]
  address: string[] | null
  /** The printable address label page in the shop. */
  labelUrl: string
  accountUrl: string | null
  shopUrl: string
  contact: EmailContact | null
  seller: string | null
  /** The shop's shipping advice (`emailCopy.shippingHint`); `null` – none. */
  shippingHint: string | null
  /** The shop's packing advice (`emailCopy.packingHint`); `null` – none. */
  packingHint: string | null
}

/** Alert to the shop's contact address about a new return (spec 6e-b §5.5). */
export interface ReturnAlertEmailData {
  displayId: number
  returnNumber: number
  orderId: string
  /** The customer's e-mail from the order, `null` when the order has none. */
  email: string | null
  items: ReturnEmailLine[]
  /** The first customer note of the return's lines, `null` – none. */
  note: string | null
  /** The order in the Medusa admin (`MEDUSA_ADMIN_URL`), `null` – the address is not set. */
  adminUrl: string | null
  shopUrl: string
  /** Added to „przyjmij zwrot w zamówieniu w panelu Medusy” (`emailCopy.afterReceiveHint`); `null` – nothing. */
  afterReceiveHint: string | null
}

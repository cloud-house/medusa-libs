import type { EmailContact, ShopContact } from '@cloud-house/medusa-emails'

/** The order as the invoice sees it – what the shop's `resolveOrder` returns. */
export interface InvoiceOrder {
  id: string
  displayId: number
  email: string | null
  totalCents: number
  createdAt: Date
  nip: string | null
  billing: {
    firstName: string
    lastName: string
    company: string | null
    address1: string
    address2: string | null
    postalCode: string
    city: string
  }
  items: {
    /** The order line id – what a return's `item_id` points at. */
    id: string
    name: string
    sku: string | null
    quantity: number
    unitPriceCents: number
    totalCents: number
    taxRate: number | null
  }[]
  shipping: { name: string; totalCents: number; taxRate: number | null } | null
  paid: boolean
  paidAt: Date | null
  providerId: string | null
  canceled: boolean
  hasAccount: boolean
  /** Placed in the shop (has an `order_cart` link) – not a draft order made in the admin. */
  shopOrder: boolean
}

/** How many pieces of an order line are where in the return process. */
export interface ReturnQuantities {
  quantity: number
  shipped: number
  requested: number
  received: number
  dismissed: number
}

/**
 * What the credit notes need of an order: its lines with their return quantities, to tell whether
 * the whole order is back. The shop's richer order object fits (extra fields are ignored).
 */
export interface ReturnOrder {
  items: { quantities: ReturnQuantities }[]
}

/** A Medusa return of the order; `items[].reason` is the `return_reason.value` (the shop's code). */
export interface ReturnRow {
  id: string
  displayId: number
  orderId: string
  status: string
  requestedAt: Date | null
  receivedAt: Date | null
  noNotification: boolean
  items: {
    itemId: string
    quantity: number
    receivedQuantity: number
    reason: string | null
    note: string | null
  }[]
}

/** The shop's contact data with the address replies to the invoice e-mail go to. */
export type InvoiceContact = ShopContact & { replyTo?: string | null }

/** What the account shows of an invoice (the same shape the storefront reads). */
export interface AccountInvoice {
  state: 'ready' | 'preparing'
}

/** The customer's invoice e-mail; the PDF goes as the notification attachment. */
export interface InvoiceEmailData {
  displayId: number
  number: string
  /** Gross total in zł. */
  total: number
  /** The order in the customer account, `null` for a guest order. */
  accountUrl: string | null
  shopUrl: string
  seller: string | null
  contact: EmailContact
}

/** What went wrong with an invoice – one alert per problem; `correction` – a credit note of a return. */
export type InvoiceAlertKind = 'issue' | 'ksef' | 'total' | 'email' | 'correction'

/** Alert to the shop's contact address. */
export interface InvoiceAlertEmailData {
  displayId: number
  orderId: string
  kind: InvoiceAlertKind
  message: string
  /** The order in the Medusa admin (`MEDUSA_ADMIN_URL`), `null` – the address is not set. */
  adminUrl: string | null
  shopUrl: string
}

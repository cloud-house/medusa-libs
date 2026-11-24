import type { ShopContact } from '@cloud-house/medusa-emails'
import type { ReturnQuantities, ReturnWindowFulfillment } from '@cloud-house/commerce-rules'

/** An order item as returns see it: what it is and how many pieces are left to return. */
export interface ReturnOrderItem {
  id: string
  title: string
  variant: string | null
  thumbnail: string | null
  quantities: ReturnQuantities
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

/** What returns need to know about an order. */
export interface ReturnOrder {
  id: string
  displayId: number
  email: string | null
  /** Placed in the shop (has an `order_cart` link) – not a draft order made in the admin. */
  shopOrder: boolean
  canceled: boolean
  items: ReturnOrderItem[]
  fulfillments: ReturnWindowFulfillment[]
  returns: ReturnRow[]
}

/** The shop's contact data plus its return rules: the window, the address the goods go back to, the reply-to address. */
export type ReturnContact = ShopContact & {
  /** Length of the return window in days; `null` – the plugin falls back to `RETURN_WINDOW_DAYS`. */
  returnDays: number | null
  /** The address the goods go back to, in lines; `null` while unknown. */
  returnAddress: string[] | null
  replyTo?: string | null
}

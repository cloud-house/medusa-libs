import type { OrderStatusKey } from './account'
import type { OrderSummary } from './checkout'
import type { ReturnInfo } from './returns'

/** `GET /store/account/profile` – the signed-in customer. */
export interface AccountProfile {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  /** The e-mail was confirmed with the link – guest orders with this e-mail join the account. */
  email_confirmed: boolean
}

export interface AccountProfileResponse {
  customer: AccountProfile
}

/** One row of `GET /store/account/orders` (newest first). */
export interface AccountOrderListItem {
  id: string
  display_id: number
  created_at: string
  total: number
  status: OrderStatusKey
  items: { title: string; thumbnail: string | null; quantity: number }[]
  /** The order can be returned now (shipped, in the window, something left to return). */
  returnable: boolean
}

export interface AccountOrdersResponse {
  orders: AccountOrderListItem[]
}

/**
 * Invoice of an account order (spec 6c §5.8): `ready` – the PDF can be downloaded, `preparing` –
 * not yet (waiting for payment, KSeF or a check).
 */
export type AccountInvoice = { state: 'ready' | 'preparing' }

/** `GET /store/account/orders/:id` – the confirmation view plus status, parcels and returns. */
export type AccountOrderDetail = OrderSummary & {
  status: OrderStatusKey
  shipments: { tracking_number: string; tracking_url: string | null }[]
  invoice: AccountInvoice | null
  returns: ReturnInfo
}

export interface AccountOrderResponse {
  order: AccountOrderDetail
}

/** `GET|POST /store/account/cart` – the customer's last open cart. */
export interface AccountCartResponse {
  cart_id: string | null
}

/** `POST /store/account/confirm-email` – how many guest orders joined the account. */
export interface ConfirmEmailResponse {
  linked: number
}

/** `POST /store/account/set-password` – the account from the checkout got its password. */
export interface SetPasswordResponse {
  email: string
  /** Guest orders with the e-mail moved into the account. */
  linked: number
}

/** `/store/account/favorites*` – the account's favourite products, newest first (spec 5b). */
export interface FavoritesResponse {
  product_ids: string[]
  /** Merge only: the oldest entries above the limit were dropped. */
  trimmed?: boolean
}

/** `POST /store/catalog/visible` – the given products the shop still sells, in the given order. */
export interface VisibleProductsResponse {
  product_ids: string[]
}

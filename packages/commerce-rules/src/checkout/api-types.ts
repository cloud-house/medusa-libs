/** `GET /store/carts/:id/delivery-options` – checkout delivery with availability (spec 3b §4.4). */
export interface DeliveryOption {
  id: string
  /** Shipping option type code: `kurier-inpost`, `kurier-dpd`, `paczkomat-inpost`. */
  code: string
  name: string
  description: string | null
  /** Gross price for this cart (0 above the free-shipping threshold). */
  amount: number
  available: boolean
  /** Why the option is unavailable, ready for the customer. */
  reason: string | null
}

export interface DeliveryOptionsResponse {
  options: DeliveryOption[]
}

/** `GET /store/shipping-rates` – the shop's delivery methods for the price table on content pages. */
export interface ShippingRate {
  id: string
  /** Shipping option type code: `kurier-inpost`, `kurier-dpd`, `paczkomat-inpost`. */
  code: string
  name: string
  description: string | null
  /** Gross price below the free-shipping threshold. */
  amount: number
  /** Cart value from which the method is free; `null` when it never is. */
  free_from: number | null
}

export interface ShippingRatesResponse {
  rates: ShippingRate[]
}

/** `POST /store/carts/:id/checkout-check` – last check before the payment (always 200). */
export type CheckoutCheckResponse =
  | { ok: true }
  | { ok: false; field: 'delivery' | 'items'; message: string }

/** Medusa payment providers of the three Stripe methods (one `payment-stripe` entry, id `stripe`). */
export const STRIPE_PROVIDER_IDS = {
  card: 'pp_stripe_stripe',
  blik: 'pp_stripe-blik_stripe',
  p24: 'pp_stripe-przelewy24_stripe',
} as const

export const STRIPE_PROVIDERS: string[] = Object.values(STRIPE_PROVIDER_IDS)

/** Line of a placed order shown on the confirmation page. */
export interface OrderSummaryItem {
  id: string
  variant_id: string | null
  title: string
  product_title: string | null
  product_handle: string | null
  variant_title: string | null
  thumbnail: string | null
  quantity: number
  /** Gross line total after discounts. */
  total: number
  original_total: number
  metadata: Record<string, unknown> | null
}

export interface OrderSummaryAddress {
  first_name: string | null
  last_name: string | null
  company: string | null
  address_1: string | null
  address_2: string | null
  postal_code: string | null
  city: string | null
  country_code: string | null
  phone: string | null
}

/** `GET /store/checkout/orders/:id?cart_id=` – full order only for the cart it came from. */
export interface OrderSummary {
  id: string
  display_id: number
  email: string | null
  created_at: string
  /** Medusa payment status, e.g. `captured`, `authorized`, `awaiting`, `not_paid`. */
  payment_status: string
  items: OrderSummaryItem[]
  item_total: number
  original_item_total: number
  shipping_total: number
  tax_total: number
  total: number
  shipping_address: OrderSummaryAddress | null
  billing_address: OrderSummaryAddress | null
  shipping_method: {
    name: string
    code: string | null
    amount: number
    data: Record<string, unknown> | null
  } | null
  metadata: Record<string, unknown> | null
  /** Promotion codes the customer typed, in line order; automatic (bundle) promotions left out. */
  codes: string[]
}

/** What anyone with the order id sees: enough for "Zamówienie nr …", nothing personal. */
export interface OrderReference {
  id: string
  display_id: number
}

export interface CheckoutOrderResponse {
  order: OrderSummary | OrderReference
  /**
   * With the full order only: an account with the order e-mail exists and has a password (or the
   * e-mail is another Medusa login) – the page offers nothing (spec 5a §3.2, part 2 §5.3).
   */
  has_account?: boolean
  /** The account with this e-mail still waits for its password („Ustaw hasło” e-mail). */
  account_pending?: boolean
  /** The order had „Chcę założyć konto w sklepie” ticked. */
  create_account?: boolean
}

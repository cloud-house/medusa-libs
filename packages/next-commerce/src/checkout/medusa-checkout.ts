import {
  type CheckoutCheckResponse,
  type CheckoutOrderResponse,
  type DeliveryOption,
  type DeliveryOptionsResponse,
  STRIPE_PROVIDER_IDS,
  STRIPE_PROVIDERS,
} from '@cloud-house/commerce-rules'
import type { HttpTypes } from '@medusajs/types'
import { CART_FIELDS, type CartClient, retrieveCart, saveShippingMethod } from '../cart/client'
import type { CartUpdate, PaymentMethod } from './form'

type Cart = HttpTypes.StoreCart

/** Pola koszyka dla checkoutu: widok koszyka + kontakt, adresy, dostawa i płatność. */
export const CHECKOUT_FIELDS = [
  CART_FIELDS,
  '+email',
  '+region_id',
  '+metadata',
  '+shipping_address.*',
  '+billing_address.*',
  '+shipping_methods.shipping_option_id',
  '+shipping_methods.data',
  '+shipping_methods.amount',
  '+shipping_methods.name',
  '+shipping_total',
  '+tax_total',
  '+payment_collection.id',
  '+payment_collection.payment_sessions.provider_id',
  '+payment_collection.payment_sessions.data',
].join(',')

const cartPath = (cartId: string) => `/store/carts/${encodeURIComponent(cartId)}`
const statusOf = (error: unknown) => (error as { status?: number } | null)?.status

export function retrieveCheckoutCart(client: CartClient, cartId: string): Promise<Cart | null> {
  return retrieveCart(client, cartId, CHECKOUT_FIELDS)
}

/**
 * Koszyk dla powrotu z banku – także już ukończony: webhook Stripe mógł złożyć zamówienie,
 * zanim przeglądarka wróciła (`completeCart` zwróci wtedy to samo zamówienie).
 */
export async function retrieveReturnCart(client: CartClient, cartId: string): Promise<Cart | null> {
  try {
    const { cart } = await client.fetch<{ cart: Cart }>(cartPath(cartId), {
      query: { fields: CHECKOUT_FIELDS },
      cache: 'no-store',
    })
    return cart
  } catch (error) {
    if (statusOf(error) === 404) return null
    throw error
  }
}

export async function fetchDeliveryOptions(
  client: CartClient,
  cartId: string,
): Promise<DeliveryOption[]> {
  const { options } = await client.fetch<DeliveryOptionsResponse>(
    `${cartPath(cartId)}/delivery-options`,
    { cache: 'no-store' },
  )
  return options
}

/** Kod paczkomatu trafia do `data` metody dostawy (backend sprawdza go w hooku `validate`). */
export async function setShippingMethod(
  client: CartClient,
  cartId: string,
  optionId: string,
  parcelLocker: string | null,
  parcelLockerLabel: string | null = null,
): Promise<void> {
  await saveShippingMethod(
    client,
    cartId,
    optionId,
    parcelLocker
      ? {
          parcel_locker: parcelLocker,
          ...(parcelLockerLabel ? { parcel_locker_label: parcelLockerLabel } : {}),
        }
      : null,
  )
}

export async function updateCartDetails(
  client: CartClient,
  cartId: string,
  update: CartUpdate,
): Promise<void> {
  await client.fetch(cartPath(cartId), { method: 'POST', body: update })
}

/** Ostatnie sprawdzenie przed płatnością (dostawa pasuje do koszyka, towar jest). */
export async function runCheckoutCheck(
  client: CartClient,
  cartId: string,
): Promise<{ field: 'delivery' | 'items'; message: string } | null> {
  const result = await client.fetch<CheckoutCheckResponse>(`${cartPath(cartId)}/checkout-check`, {
    method: 'POST',
  })
  return result.ok ? null : { field: result.field, message: result.message }
}

export async function fetchPaymentProviders(
  client: CartClient,
  regionId: string,
): Promise<string[]> {
  const { payment_providers } = await client.fetch<{ payment_providers: { id: string }[] }>(
    '/store/payment-providers',
    { query: { region_id: regionId }, cache: 'no-store' },
  )
  return payment_providers.map((provider) => provider.id)
}

/** Płatności online działają, gdy region ma trzy providery Stripe, a sklep klucz publiczny. */
export function paymentAvailability(
  providers: string[],
  publishableKey: string | undefined,
): boolean {
  return Boolean(publishableKey) && STRIPE_PROVIDERS.every((id) => providers.includes(id))
}

const PROVIDER_BY_METHOD: Record<PaymentMethod, string> = {
  blik: STRIPE_PROVIDER_IDS.blik,
  p24: STRIPE_PROVIDER_IDS.p24,
  card: STRIPE_PROVIDER_IDS.card,
}

type PaymentCollection = {
  id: string
  payment_sessions?: { provider_id: string; data?: Record<string, unknown> }[]
}

/**
 * Sesja płatności Stripe dla wybranej metody (nowa sesja zastępuje poprzednią). Karta tylko jako
 * karta – portfele (Apple Pay, Google Pay) idą przez typ `card`.
 */
export async function createPaymentSession(
  client: CartClient,
  cart: { id: string; payment_collection?: { id: string } | null },
  method: PaymentMethod,
): Promise<{ provider: string; clientSecret: string }> {
  const collectionId =
    cart.payment_collection?.id ??
    (
      await client.fetch<{ payment_collection: PaymentCollection }>('/store/payment-collections', {
        method: 'POST',
        body: { cart_id: cart.id },
      })
    ).payment_collection.id
  const provider = PROVIDER_BY_METHOD[method]
  const { payment_collection } = await client.fetch<{ payment_collection: PaymentCollection }>(
    `/store/payment-collections/${encodeURIComponent(collectionId)}/payment-sessions`,
    {
      method: 'POST',
      body:
        method === 'card'
          ? { provider_id: provider, data: { payment_method_types: ['card'] } }
          : { provider_id: provider },
    },
  )
  const session = payment_collection.payment_sessions?.find((s) => s.provider_id === provider)
  const clientSecret = session?.data?.client_secret
  if (typeof clientSecret !== 'string') throw new Error('Stripe nie zwrócił client_secret.')
  return { provider, clientSecret }
}

const NOT_CONFIRMED =
  'Płatność nie została potwierdzona. Spróbuj ponownie albo wybierz inną metodę.'
const NOT_PLACED = 'Nie udało się złożyć zamówienia. Spróbuj ponownie.'

export async function completeCart(
  client: CartClient,
  cartId: string,
): Promise<{ ok: true; orderId: string } | { ok: false; message: string }> {
  try {
    const result = await client.fetch<
      { type: 'order'; order: { id: string } } | { type: 'cart'; error?: { message?: string } }
    >(`${cartPath(cartId)}/complete`, { method: 'POST' })
    if (result.type === 'order') return { ok: true, orderId: result.order.id }
    return { ok: false, message: NOT_CONFIRMED }
  } catch (error) {
    const status = statusOf(error)
    return { ok: false, message: status && status < 500 ? NOT_CONFIRMED : NOT_PLACED }
  }
}

export async function fetchOrderSummary(
  client: CartClient,
  orderId: string,
  cartId: string | null,
): Promise<CheckoutOrderResponse['order'] | null> {
  return (await fetchOrderPage(client, orderId, cartId))?.order ?? null
}

/** Potwierdzenie z informacją, czy e-mail zamówienia ma już konto (tylko pełny widok, 5a). */
export async function fetchOrderPage(
  client: CartClient,
  orderId: string,
  cartId: string | null,
): Promise<{
  order: CheckoutOrderResponse['order']
  hasAccount: boolean
  createAccount: boolean
  accountPending: boolean
} | null> {
  try {
    const { order, has_account, create_account, account_pending } =
      await client.fetch<CheckoutOrderResponse>(
        `/store/checkout/orders/${encodeURIComponent(orderId)}`,
        { ...(cartId ? { query: { cart_id: cartId } } : {}), cache: 'no-store' },
      )
    return {
      order,
      hasAccount: Boolean(has_account),
      createAccount: Boolean(create_account),
      accountPending: Boolean(account_pending),
    }
  } catch (error) {
    if (statusOf(error) === 404) return null
    throw error
  }
}

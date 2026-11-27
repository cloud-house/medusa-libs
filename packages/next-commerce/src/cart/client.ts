import type { HttpTypes } from '@medusajs/types'
import type { CartActionResult, CartItemInput } from './types'

type Cart = HttpTypes.StoreCart

/** Część `client` z `@medusajs/js-sdk` używana przez koszyk – wstrzykiwana, żeby dało się testować. */
export interface CartClient {
  fetch<T>(
    path: string,
    init?: {
      method?: 'GET' | 'POST' | 'DELETE'
      body?: unknown
      query?: Record<string, string>
      /** Customer token (`authorization`) for carts of a signed-in customer (5a). */
      headers?: Record<string, string>
      cache?: 'no-store'
    },
  ): Promise<T>
}

/** Pola dla `toCartView` – dopisane („+”) do domyślnych pól koszyka w Store API. */
export const CART_FIELDS = [
  '+completed_at',
  '+item_total',
  '+original_item_total',
  '+total',
  '+items.total',
  '+items.original_total',
  '+items.created_at',
  '+items.metadata',
  '+items.product_handle',
  '+items.product_title',
  '+items.variant_title',
  '+items.subtotal',
  '+items.adjustments.code',
  '+items.adjustments.amount',
  '+items.adjustments.is_tax_inclusive',
  '+promotions.code',
  '+promotions.is_automatic',
].join(',')

/** Komunikat trasy dodawania dla ukończonego koszyka (np. `bundle-items` sklepu). */
const CLOSED_CART = 'Ten koszyk jest już zamknięty.'
const RETRY = 'Nie udało się zaktualizować koszyka. Spróbuj ponownie.'

const statusOf = (error: unknown) => (error as { status?: number } | null)?.status
const messageOf = (error: unknown) => (error instanceof Error ? error.message : '')

/** Koszyk z ciasteczka albo `null` (nie ma go w Medusie albo jest już zamówieniem). */
export async function retrieveCart(
  client: CartClient,
  cartId: string,
  fields = CART_FIELDS,
): Promise<Cart | null> {
  try {
    const { cart } = await client.fetch<{ cart: Cart }>(
      `/store/carts/${encodeURIComponent(cartId)}`,
      {
        query: { fields },
        cache: 'no-store',
      },
    )
    return cart.completed_at ? null : cart
  } catch (error) {
    if (statusOf(error) === 404) return null
    throw error
  }
}

async function createCart(client: CartClient, regionId: string): Promise<string> {
  const { cart } = await client.fetch<{ cart: Cart }>('/store/carts', {
    method: 'POST',
    body: { region_id: regionId },
  })
  return cart.id
}

/** How items reach a cart; the shop may use a route that adds all of them or none. */
export type AddItems = (client: CartClient, cartId: string, items: CartItemInput[]) => Promise<void>

/** Medusa's standard route, one item after the other. */
export const addLineItems: AddItems = async (client, cartId, items) => {
  for (const item of items) {
    await client.fetch(`/store/carts/${encodeURIComponent(cartId)}/line-items`, {
      method: 'POST',
      body: item,
    })
  }
}

/** Medusa's own answer for a completed cart on its standard routes (core-flows `validate-cart`). */
const MEDUSA_COMPLETED = /already completed/i

const isStale = (error: unknown) =>
  statusOf(error) === 404 ||
  (statusOf(error) === 400 &&
    (messageOf(error) === CLOSED_CART || MEDUSA_COMPLETED.test(messageOf(error))))

/**
 * Dodaje pozycje (`addItems`, domyślnie standardowe `line-items`). Bez koszyka albo z nieaktualnym
 * (usunięty, zamknięty) zakłada nowy w regionie i ponawia raz; zwraca id koszyka do ciasteczka.
 */
export async function addToCartFlow(
  client: CartClient,
  input: {
    cartId: string | null
    regionId: () => Promise<string>
    items: CartItemInput[]
    addItems?: AddItems
  },
): Promise<{ cartId: string }> {
  const addItems = input.addItems ?? addLineItems
  if (input.cartId) {
    try {
      await addItems(client, input.cartId, input.items)
      return { cartId: input.cartId }
    } catch (error) {
      if (!isStale(error)) throw error
    }
  }
  const cartId = await createCart(client, await input.regionId())
  await addItems(client, cartId, input.items)
  return { cartId }
}

export async function updateItem(
  client: CartClient,
  cartId: string,
  lineId: string,
  quantity: number,
): Promise<void> {
  await client.fetch(
    `/store/carts/${encodeURIComponent(cartId)}/line-items/${encodeURIComponent(lineId)}`,
    {
      method: 'POST',
      body: { quantity },
    },
  )
}

export async function removeItems(
  client: CartClient,
  cartId: string,
  lineIds: string[],
): Promise<void> {
  for (const lineId of lineIds) {
    await client.fetch(
      `/store/carts/${encodeURIComponent(cartId)}/line-items/${encodeURIComponent(lineId)}`,
      { method: 'DELETE' },
    )
  }
}

export async function addPromotionCode(
  client: CartClient,
  cartId: string,
  code: string,
): Promise<Cart> {
  const { cart } = await client.fetch<{ cart: Cart }>(
    `/store/carts/${encodeURIComponent(cartId)}/promotions`,
    {
      method: 'POST',
      body: { promo_codes: [code] },
      query: { fields: CART_FIELDS },
    },
  )
  return cart
}

export async function removePromotionCode(
  client: CartClient,
  cartId: string,
  code: string,
): Promise<void> {
  await client.fetch(`/store/carts/${encodeURIComponent(cartId)}/promotions`, {
    method: 'DELETE',
    body: { promo_codes: [code] },
  })
}

/** Zapis metody dostawy; `data` (paczkomat) idzie do Medusy tylko wtedy, gdy coś zawiera. */
export async function saveShippingMethod(
  client: CartClient,
  cartId: string,
  optionId: string,
  data: Record<string, unknown> | null,
): Promise<void> {
  const extra = data && Object.keys(data).length ? data : null
  await client.fetch(`/store/carts/${encodeURIComponent(cartId)}/shipping-methods`, {
    method: 'POST',
    body: extra ? { option_id: optionId, data: extra } : { option_id: optionId },
  })
}

type ShippingMethodRef = {
  shipping_option_id?: string | null
  data?: Record<string, unknown> | null
}

async function reapplyShippingMethod(
  client: CartClient,
  cartId: string,
  methods: ShippingMethodRef[] | null | undefined,
): Promise<void> {
  const [method] = methods ?? []
  if (!method?.shipping_option_id) return
  await saveShippingMethod(client, cartId, method.shipping_option_id, method.data ?? null)
}

/**
 * Medusa 2.21 nie przelicza wybranej dostawy po zmianie kodu rabatowego – kod, który zbija
 * wartość produktów pod próg darmowej dostawy, zostawiłby „Dostawa 0 zł”. Zapisujemy tę samą
 * opcję (z danymi paczkomatu) jeszcze raz (część 2 §4.5).
 */
export async function refreshShippingMethod(client: CartClient, cartId: string): Promise<void> {
  const cart = await retrieveCart(client, cartId)
  await reapplyShippingMethod(client, cartId, cart?.shipping_methods as ShippingMethodRef[])
}

/** Polski komunikat dla klienta z błędu Medusy albo sieci. */
export function cartErrorMessage(error: unknown): string {
  const message = messageOf(error)
  const status = statusOf(error)
  if (status === undefined || status >= 500) return RETRY
  const code = message.match(/promotion code (.+) is invalid/i)?.[1]
  if (code) return `Kod ${code} jest nieprawidłowy albo wygasł.`
  if (/inventory/i.test(message)) return 'Nie mamy tylu sztuk tego produktu.'
  // Trasy sklepu i pluginów kitu odpowiadają po polsku – przepuszczamy ich komunikaty.
  return /[ąćęłńóśźż]|szt\.|koszyk|paczkomat/i.test(message) ? message : RETRY
}

export const MAX_QUANTITY = 9
export function validateQuantity(quantity: unknown): boolean {
  return (
    Number.isInteger(quantity) && (quantity as number) >= 1 && (quantity as number) <= MAX_QUANTITY
  )
}

/** Id pozycji z przeglądarki trafia do ścieżki Medusy – tylko znaki id Medusy. */
export function validateLineId(lineId: unknown): boolean {
  return typeof lineId === 'string' && /^[A-Za-z0-9_]{1,100}$/.test(lineId)
}

/** Ilość pozycji w koszyku: 1–99 (dodania tego samego wariantu się scalają, więc bywa > 9). */
export function validateLineQuantity(quantity: unknown): boolean {
  return Number.isInteger(quantity) && (quantity as number) >= 1 && (quantity as number) <= 99
}

const invalidCode = (error: unknown) =>
  statusOf(error) === 400 && /promotion code .+ is invalid/i.test(messageOf(error))

/**
 * Kod rabatowy: Medusa porównuje kody dokładnie, więc wpisany małymi literami próbujemy jeszcze
 * raz wielkimi. Kod poprawny, ale nieobejmujący koszyka, Medusa pomija bez błędu – sprawdzamy,
 * czy jest w koszyku.
 */
export async function applyCodeFlow(
  client: CartClient,
  cartId: string,
  code: string,
): Promise<CartActionResult> {
  const rejected = { ok: false as const, message: `Kod ${code} jest nieprawidłowy albo wygasł.` }
  let cart: Cart
  try {
    cart = await addPromotionCode(client, cartId, code)
  } catch (error) {
    if (!invalidCode(error) || code === code.toUpperCase()) throw error
    try {
      cart = await addPromotionCode(client, cartId, code.toUpperCase())
    } catch (retryError) {
      if (invalidCode(retryError)) return rejected
      throw retryError
    }
  }
  const applied = (cart.promotions ?? []).some(
    (promotion) => promotion.code?.toLowerCase() === code.toLowerCase(),
  )
  if (!applied) return rejected
  // Koszyk z odpowiedzi zna już wybraną dostawę (domyślne pola Store API).
  await reapplyShippingMethod(client, cartId, cart.shipping_methods as ShippingMethodRef[])
  return { ok: true }
}

import { describe, expect, it } from 'vitest'
import {
  addToCartFlow,
  applyCodeFlow,
  CART_FIELDS,
  cartErrorMessage,
  refreshShippingMethod,
  retrieveCart,
  saveShippingMethod,
  updateItem,
  validateLineId,
  validateLineQuantity,
  validateQuantity,
} from './client'
import { fakeClient, httpError } from './fake-client'

describe('retrieveCart', () => {
  it('reads the cart with the view fields and without the Next cache', async () => {
    const { client, calls } = fakeClient({ 'GET /store/carts/cart_1': { cart: { id: 'cart_1' } } })

    expect(await retrieveCart(client, 'cart_1')).toEqual({ id: 'cart_1' })
    expect(calls[0]?.init).toMatchObject({ query: { fields: CART_FIELDS }, cache: 'no-store' })
  })

  it('treats a missing or completed cart as no cart', async () => {
    const missing = fakeClient({
      'GET /store/carts/cart_x': () => {
        throw httpError(404, 'Cart not found')
      },
    })
    const completed = fakeClient({
      'GET /store/carts/cart_done': { cart: { id: 'cart_done', completed_at: '2026-10-19' } },
    })

    expect(await retrieveCart(missing.client, 'cart_x')).toBeNull()
    expect(await retrieveCart(completed.client, 'cart_done')).toBeNull()
  })
})

describe('addToCartFlow', () => {
  const items = [{ variant_id: 'variant_1', quantity: 1 }]
  /** A shop route that adds all items or none (ChoNaSupa: `bundle-items`). */
  const bundle = async (
    client: Parameters<typeof addToCartFlow>[0],
    cartId: string,
    added: typeof items,
  ) => {
    await client.fetch(`/store/carts/${cartId}/bundle-items`, {
      method: 'POST',
      body: { items: added },
    })
  }

  it('the default route: a completed cart (Medusa 400 "already completed") is stale – a new cart, one retry', async () => {
    const { client, calls } = fakeClient({
      'POST /store/carts/cart_done/line-items': () => {
        throw httpError(400, 'Cart cart_done is already completed.')
      },
      'POST /store/carts': { cart: { id: 'cart_new' } },
      'POST /store/carts/cart_new/line-items': { cart: { id: 'cart_new' } },
    })
    expect(
      await addToCartFlow(client, { cartId: 'cart_done', regionId: async () => 'reg', items }),
    ).toEqual({ cartId: 'cart_new' })
    expect(calls.map((c) => c.path)).toEqual([
      '/store/carts/cart_done/line-items',
      '/store/carts',
      '/store/carts/cart_new/line-items',
    ])
  })

  it('by default adds every item through the standard line-items route', async () => {
    const { client, calls } = fakeClient({
      'POST /store/carts/cart_1/line-items': { cart: { id: 'cart_1' } },
    })
    const two = [
      { variant_id: 'variant_1', quantity: 2 },
      { variant_id: 'variant_2', quantity: 1, metadata: { note: 'x' } },
    ]
    expect(
      await addToCartFlow(client, { cartId: 'cart_1', regionId: async () => 'reg', items: two }),
    ).toEqual({
      cartId: 'cart_1',
    })
    expect(calls.map((c) => [c.path, c.init?.body])).toEqual([
      ['/store/carts/cart_1/line-items', { variant_id: 'variant_1', quantity: 2 }],
      [
        '/store/carts/cart_1/line-items',
        { variant_id: 'variant_2', quantity: 1, metadata: { note: 'x' } },
      ],
    ])
  })

  it('creates a cart in the Polish region when there is none, then adds the items', async () => {
    const { client, calls } = fakeClient({
      'POST /store/carts': { cart: { id: 'cart_new' } },
      'POST /store/carts/cart_new/bundle-items': { cart: { id: 'cart_new' } },
    })

    const result = await addToCartFlow(client, {
      cartId: null,
      regionId: async () => 'reg_pl',
      addItems: bundle,
      items,
    })

    expect(result).toEqual({ cartId: 'cart_new' })
    expect(calls.map((c) => [c.init?.method, c.path, c.init?.body])).toEqual([
      ['POST', '/store/carts', { region_id: 'reg_pl' }],
      ['POST', '/store/carts/cart_new/bundle-items', { items }],
    ])
  })

  it('replaces a stale cart once and retries the items there', async () => {
    const { client, calls } = fakeClient({
      'POST /store/carts/cart_old/bundle-items': () => {
        throw httpError(404, 'Nie znaleziono koszyka.')
      },
      'POST /store/carts': { cart: { id: 'cart_new' } },
      'POST /store/carts/cart_new/bundle-items': { cart: { id: 'cart_new' } },
    })

    expect(
      await addToCartFlow(client, {
        cartId: 'cart_old',
        regionId: async () => 'reg_pl',
        addItems: bundle,
        items,
      }),
    ).toEqual({ cartId: 'cart_new' })
    expect(calls).toHaveLength(3)
  })

  it('replaces a completed cart too', async () => {
    const { client } = fakeClient({
      'POST /store/carts/cart_done/bundle-items': () => {
        throw httpError(400, 'Ten koszyk jest już zamknięty.')
      },
      'POST /store/carts': { cart: { id: 'cart_new' } },
      'POST /store/carts/cart_new/bundle-items': { cart: { id: 'cart_new' } },
    })

    expect(
      await addToCartFlow(client, {
        cartId: 'cart_done',
        regionId: async () => 'reg_pl',
        addItems: bundle,
        items,
      }),
    ).toEqual({ cartId: 'cart_new' })
  })
})

describe('cartErrorMessage', () => {
  it('passes Polish messages of our bundle route through', () => {
    expect(cartErrorMessage(httpError(400, 'Wiosło Carbon Pro: mamy tylko 1 szt.'))).toBe(
      'Wiosło Carbon Pro: mamy tylko 1 szt.',
    )
  })

  it('passes the checkout delivery messages through, also without Polish letters', () => {
    expect(cartErrorMessage(httpError(400, 'Wybierz paczkomat.'))).toBe('Wybierz paczkomat.')
  })

  it('translates Medusa stock and promotion code errors', () => {
    expect(
      cartErrorMessage(
        httpError(400, 'Some variant does not have the required inventory: variant_1'),
      ),
    ).toBe('Nie mamy tylu sztuk tego produktu.')
    expect(cartErrorMessage(httpError(400, 'The promotion code NIEMA is invalid'))).toBe(
      'Kod NIEMA jest nieprawidłowy albo wygasł.',
    )
  })

  it('falls back to a retry message for network and server errors', () => {
    const retry = 'Nie udało się zaktualizować koszyka. Spróbuj ponownie.'
    expect(cartErrorMessage(new TypeError('fetch failed'))).toBe(retry)
    expect(cartErrorMessage(httpError(500, 'An unknown error occurred.'))).toBe(retry)
  })
})

describe('validateQuantity', () => {
  it('accepts 1–9 and rejects everything else', () => {
    expect([1, 9].map(validateQuantity)).toEqual([true, true])
    expect([0, 10, 1.5, '1', null].map(validateQuantity)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ])
  })
})

describe('applyCodeFlow', () => {
  const withCodes = (...codes: string[]) => ({
    cart: { id: 'cart_1', promotions: codes.map((code) => ({ code })) },
  })

  it('kod wpisany małymi literami: drugie podejście wielkimi', async () => {
    const { client, calls } = fakeClient({
      'POST /store/carts/cart_1/promotions': () => {
        const body = calls.at(-1)?.init?.body as { promo_codes: string[] }
        if (body.promo_codes[0] === 'wiosna10') {
          throw httpError(400, 'The promotion code wiosna10 is invalid')
        }
        return withCodes('WIOSNA10')
      },
    })

    expect(await applyCodeFlow(client, 'cart_1', 'wiosna10')).toEqual({ ok: true })
    const sent = calls.map((c) => c.init?.body as { promo_codes: string[] })
    expect(sent.map((body) => body.promo_codes)).toEqual([['wiosna10'], ['WIOSNA10']])
  })

  it('kod poprawny, ale nieobejmujący koszyka → komunikat', async () => {
    const { client } = fakeClient({ 'POST /store/carts/cart_1/promotions': withCodes() })

    expect(await applyCodeFlow(client, 'cart_1', 'LATO')).toEqual({
      ok: false,
      message: 'Kod LATO jest nieprawidłowy albo wygasł.',
    })
  })
})

describe('refreshShippingMethod (część 2 §4.5)', () => {
  const promoted = (shipping_methods: unknown[]) => ({
    cart: { id: 'cart_1', promotions: [{ code: 'E2E-10' }], shipping_methods },
  })

  it('zastosowany kod: wybrana dostawa zapisana ponownie z jej danymi', async () => {
    const locker = { shipping_option_id: 'so_locker', data: { parcel_locker: 'KRA01M' } }
    const { client, calls } = fakeClient({
      'POST /store/carts/cart_1/promotions': promoted([locker]),
      'GET /store/carts/cart_1': promoted([locker]),
      'POST /store/carts/cart_1/shipping-methods': { cart: { id: 'cart_1' } },
    })

    expect(await applyCodeFlow(client, 'cart_1', 'E2E-10')).toEqual({ ok: true })
    const posts = calls.filter((call) => call.init?.method === 'POST')
    expect(posts.map((call) => call.path)).toEqual([
      '/store/carts/cart_1/promotions',
      '/store/carts/cart_1/shipping-methods',
    ])
    expect(posts[1]?.init?.body).toEqual({
      option_id: 'so_locker',
      data: { parcel_locker: 'KRA01M' },
    })
  })

  it('kurier bez danych: sama opcja; koszyk bez dostawy – nic', async () => {
    const courier = fakeClient({
      'GET /store/carts/cart_1': promoted([{ shipping_option_id: 'so_dpd', data: {} }]),
      'POST /store/carts/cart_1/shipping-methods': { cart: { id: 'cart_1' } },
    })
    await refreshShippingMethod(courier.client, 'cart_1')
    expect(courier.calls.at(-1)?.init?.body).toEqual({ option_id: 'so_dpd' })

    const empty = fakeClient({
      'POST /store/carts/cart_1/promotions': promoted([]),
      'GET /store/carts/cart_1': promoted([]),
    })
    expect(await applyCodeFlow(empty.client, 'cart_1', 'E2E-10')).toEqual({ ok: true })
    expect(empty.calls.some((call) => call.path.endsWith('/shipping-methods'))).toBe(false)
  })
})

describe('saveShippingMethod', () => {
  it('opcja z danymi paczkomatu; puste albo brak danych – sama opcja', async () => {
    const { client, calls } = fakeClient({
      'POST /store/carts/cart_1/shipping-methods': { cart: { id: 'cart_1' } },
    })

    await saveShippingMethod(client, 'cart_1', 'so_locker', { parcel_locker: 'KRA01M' })
    await saveShippingMethod(client, 'cart_1', 'so_dpd', {})
    await saveShippingMethod(client, 'cart_1', 'so_dpd', null)

    expect(calls.map((call) => call.init?.body)).toEqual([
      { option_id: 'so_locker', data: { parcel_locker: 'KRA01M' } },
      { option_id: 'so_dpd' },
      { option_id: 'so_dpd' },
    ])
  })
})

describe('ścieżki i id z przeglądarki', () => {
  it('koduje id pozycji w ścieżce Medusy', async () => {
    const { client, calls } = fakeClient({
      'POST /store/carts/cart_1/line-items/line%2F..%2F..%2Fx': {},
    })

    await updateItem(client, 'cart_1', 'line/../../x', 2)

    expect(calls[0]?.path).toBe('/store/carts/cart_1/line-items/line%2F..%2F..%2Fx')
  })

  it('przyjmuje tylko id pozycji Medusy i ilość 1–99 w koszyku', () => {
    expect(validateLineId('cali_01ABC')).toBe(true)
    expect(validateLineId('../customers/me')).toBe(false)
    expect(validateLineId('')).toBe(false)
    expect(validateLineQuantity(11)).toBe(true)
    expect(validateLineQuantity(99)).toBe(true)
    expect(validateLineQuantity(100)).toBe(false)
    expect(validateLineQuantity(0)).toBe(false)
  })
})

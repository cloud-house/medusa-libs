import { describe, expect, it, vi } from 'vitest'
import { fakeClient, httpError } from '../cart/fake-client'
import { placeOrderFlow, submitCheckoutFlow } from './flow'
import { type CheckoutForm, emptyCheckoutForm } from './form'

const NOW = new Date('2026-10-19T10:00:00.000Z')

const form = (overrides: Partial<CheckoutForm> = {}): CheckoutForm => ({
  ...emptyCheckoutForm(),
  email: 'jan@example.pl',
  phone: '600100200',
  shipping: {
    firstName: 'Jan',
    lastName: 'Kowalski',
    address1: 'ul. Morska 5',
    postalCode: '80-001',
    city: 'Gdańsk',
  },
  deliveryOptionId: 'so_locker',
  deliveryCode: 'paczkomat-inpost',
  parcelLocker: 'KRA01M',
  blikCode: '123456',
  terms: true,
  ...overrides,
})

const cartWithLocker = {
  id: 'cart_1',
  payment_collection: { id: 'paycol_1' },
  shipping_methods: [{ shipping_option_id: 'so_locker', data: { parcel_locker: 'KRA01M' } }],
}

function client(check: unknown = { ok: true }) {
  return fakeClient({
    'POST /store/carts/cart_1': { cart: {} },
    'POST /store/carts/cart_1/shipping-methods': { cart: {} },
    'POST /store/carts/cart_1/checkout-check': check,
    'POST /store/payment-collections/paycol_1/payment-sessions': {
      payment_collection: {
        id: 'paycol_1',
        payment_sessions: [
          { provider_id: 'pp_stripe-blik_stripe', data: { client_secret: 'pi_1_secret_x' } },
        ],
      },
    },
    'POST /store/carts/cart_1/complete': { type: 'order', order: { id: 'order_1' } },
  })
}

describe('submitCheckoutFlow', () => {
  it('stops on form errors without calling Medusa', async () => {
    const { client: c, calls } = client()

    const result = await submitCheckoutFlow(
      c,
      cartWithLocker,
      form({ email: '', terms: false }),
      NOW,
    )

    expect(result).toEqual({
      ok: false,
      message: 'Popraw zaznaczone pola.',
      errors: {
        email: 'Podaj adres e-mail.',
        terms: 'Zaakceptuj regulamin, żeby złożyć zamówienie.',
      },
    })
    expect(calls).toEqual([])
  })

  it('saves the details and the delivery, checks the cart and opens the payment session', async () => {
    const { client: c, calls } = client()

    expect(await submitCheckoutFlow(c, cartWithLocker, form(), NOW)).toEqual({
      ok: true,
      provider: 'pp_stripe-blik_stripe',
      clientSecret: 'pi_1_secret_x',
    })
    expect(calls.map((call) => call.path)).toEqual([
      '/store/carts/cart_1',
      '/store/carts/cart_1/shipping-methods',
      '/store/carts/cart_1/checkout-check',
      '/store/payment-collections/paycol_1/payment-sessions',
    ])
    expect(calls[0]?.init?.body).toMatchObject({
      email: 'jan@example.pl',
      metadata: { terms_accepted_at: NOW.toISOString() },
    })
  })

  it('newsletter: zapis po zapisaniu danych koszyka, błąd zapisu nie zatrzymuje płatności', async () => {
    const { client: c, calls } = client()
    const order: string[] = []
    const subscribeNewsletter = vi.fn(async (email: string) => {
      order.push(`newsletter:${email}:${calls.length}`)
    })

    expect(
      await submitCheckoutFlow(c, cartWithLocker, form({ newsletter: true }), NOW, {
        subscribeNewsletter,
      }),
    ).toMatchObject({ ok: true })
    // Po `POST /store/carts/cart_1` (pierwsze wywołanie), przed sprawdzeniem koszyka.
    expect(order).toEqual(['newsletter:jan@example.pl:1'])

    const failing = vi.fn(async () => {
      throw new Error('payload down')
    })
    const { client: again } = client()
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(
      await submitCheckoutFlow(again, cartWithLocker, form({ newsletter: true }), NOW, {
        subscribeNewsletter: failing,
      }),
    ).toEqual({ ok: true, provider: 'pp_stripe-blik_stripe', clientSecret: 'pi_1_secret_x' })
    expect(log).toHaveBeenCalled()
    log.mockRestore()
  })

  it('zalogowany: serwer nie ufa polu „Chcę założyć konto” z przeglądarki', async () => {
    const { client: c, calls } = client()

    await submitCheckoutFlow(c, cartWithLocker, form({ createAccount: true }), NOW, {
      signedIn: true,
    })
    expect(calls[0]?.init?.body).toMatchObject({ metadata: { create_account: '' } })

    const guest = client()
    await submitCheckoutFlow(guest.client, cartWithLocker, form({ createAccount: true }), NOW)
    expect(guest.calls[0]?.init?.body).toMatchObject({ metadata: { create_account: 'tak' } })
  })

  it('bez zaznaczonego newslettera nic nie zapisuje', async () => {
    const { client: c } = client()
    const subscribeNewsletter = vi.fn(async () => {})
    await submitCheckoutFlow(c, cartWithLocker, form(), NOW, { subscribeNewsletter })
    expect(subscribeNewsletter).not.toHaveBeenCalled()
  })

  it('a failed checkout-check opens no payment session', async () => {
    const problem = {
      ok: false,
      field: 'delivery',
      message:
        'Paczkomat jest niedostępny dla tych produktów – wybierz kuriera. Deski nie mieszczą się w paczkomacie.',
    }
    const { client: c, calls } = client(problem)

    expect(await submitCheckoutFlow(c, cartWithLocker, form(), NOW)).toEqual({
      ok: false,
      field: 'delivery',
      message: problem.message,
    })
    expect(calls.some((call) => call.path.includes('payment-sessions'))).toBe(false)
  })

  it('sets the chosen delivery again when the cart has another one', async () => {
    const { client: c, calls } = client()
    const courierCart = {
      ...cartWithLocker,
      shipping_methods: [{ shipping_option_id: 'so_dpd', data: {} }],
    }

    await submitCheckoutFlow(c, courierCart, form(), NOW)

    expect(calls[1]).toMatchObject({
      path: '/store/carts/cart_1/shipping-methods',
      init: { body: { option_id: 'so_locker', data: { parcel_locker: 'KRA01M' } } },
    })
  })

  it('zapisuje wybraną dostawę jeszcze raz także wtedy, gdy koszyk już ją ma', async () => {
    // Odświeżenie dostawy po zmianie kodu rabatowego mogło się nie udać – w koszyku zostaje ta
    // sama opcja ze starą ceną (np. „Dostawa 0 zł” pod progiem po dodaniu kodu, 16,99 zł po jego
    // usunięciu, kiedy koszyk nie ma już żadnej promocji).
    const { client: c, calls } = client()
    const withCode = { ...cartWithLocker, promotions: [{ code: 'LATO10' }] }

    expect(await submitCheckoutFlow(c, withCode, form(), NOW)).toMatchObject({ ok: true })
    expect(calls.map((call) => call.path)).toEqual([
      '/store/carts/cart_1',
      '/store/carts/cart_1/shipping-methods',
      '/store/carts/cart_1/checkout-check',
      '/store/payment-collections/paycol_1/payment-sessions',
    ])
    expect(calls[1]?.init?.body).toEqual({
      option_id: 'so_locker',
      data: { parcel_locker: 'KRA01M' },
    })
  })

  it('a refused delivery is shown at Dostawa and opens no payment session', async () => {
    const message = 'Paczkomat jest niedostępny dla tych produktów – wybierz kuriera.'
    const { client: c, calls } = fakeClient({
      'POST /store/carts/cart_1': { cart: {} },
      'POST /store/carts/cart_1/shipping-methods': () => {
        throw httpError(400, message)
      },
    })
    const courierCart = {
      ...cartWithLocker,
      shipping_methods: [{ shipping_option_id: 'so_dpd', data: {} }],
    }

    expect(await submitCheckoutFlow(c, courierCart, form(), NOW)).toEqual({
      ok: false,
      field: 'delivery',
      message,
    })
    expect(calls.map((call) => call.path)).toEqual([
      '/store/carts/cart_1',
      '/store/carts/cart_1/shipping-methods',
    ])
  })
})

describe('placeOrderFlow', () => {
  it('completes the cart', async () => {
    const { client: c } = client()

    expect(await placeOrderFlow(c, 'cart_1')).toEqual({ ok: true, orderId: 'order_1' })
  })
})

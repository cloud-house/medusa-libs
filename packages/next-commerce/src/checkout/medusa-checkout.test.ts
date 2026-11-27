import { STRIPE_PROVIDERS } from '@cloud-house/commerce-rules'
import { describe, expect, it } from 'vitest'
import { fakeClient, httpError } from '../cart/fake-client'
import {
  CHECKOUT_FIELDS,
  completeCart,
  createPaymentSession,
  fetchDeliveryOptions,
  fetchOrderSummary,
  fetchPaymentProviders,
  paymentAvailability,
  retrieveCheckoutCart,
  runCheckoutCheck,
  setShippingMethod,
  updateCartDetails,
} from './medusa-checkout'

describe('retrieveCheckoutCart', () => {
  it('reads the cart with addresses and the delivery; a completed cart is no cart', async () => {
    const { client, calls } = fakeClient({
      'GET /store/carts/cart_1': { cart: { id: 'cart_1' } },
      'GET /store/carts/cart_done': { cart: { id: 'cart_done', completed_at: '2026-10-19' } },
    })

    expect(await retrieveCheckoutCart(client, 'cart_1')).toEqual({ id: 'cart_1' })
    expect(await retrieveCheckoutCart(client, 'cart_done')).toBeNull()
    expect(calls[0]?.init).toMatchObject({ query: { fields: CHECKOUT_FIELDS }, cache: 'no-store' })
    expect(CHECKOUT_FIELDS).toContain('+shipping_address.*')
    expect(CHECKOUT_FIELDS).toContain('+shipping_methods.data')
  })
})

describe('delivery', () => {
  it('lists the options from the ChoNaSupa route', async () => {
    const options = [{ id: 'so_1', code: 'kurier-dpd' }]
    const { client } = fakeClient({
      'GET /store/carts/cart_1/delivery-options': { options },
    })

    expect(await fetchDeliveryOptions(client, 'cart_1')).toEqual(options)
  })

  it('sends the parcel locker code only for the parcel locker', async () => {
    const { client, calls } = fakeClient({ 'POST /store/carts/cart_1/shipping-methods': {} })

    await setShippingMethod(client, 'cart_1', 'so_dpd', null)
    await setShippingMethod(client, 'cart_1', 'so_locker', 'KRA01M')

    expect(calls.map((c) => c.init?.body)).toEqual([
      { option_id: 'so_dpd' },
      { option_id: 'so_locker', data: { parcel_locker: 'KRA01M' } },
    ])
  })
})

describe('details and checks', () => {
  it('posts the form data to the cart', async () => {
    const { client, calls } = fakeClient({ 'POST /store/carts/cart_1': { cart: {} } })
    const update = {
      email: 'jan@example.pl',
      shipping_address: {
        first_name: 'Jan',
        last_name: 'K',
        address_1: 'a',
        postal_code: '80-001',
        city: 'G',
        country_code: 'pl' as const,
      },
      billing_address: {
        first_name: 'Jan',
        last_name: 'K',
        address_1: 'a',
        postal_code: '80-001',
        city: 'G',
        country_code: 'pl' as const,
      },
      metadata: {
        nip: '',
        terms_accepted_at: '2026-10-19T10:00:00.000Z',
        save_to_account: '' as const,
        customer_note: '',
        create_account: '' as const,
      },
    }

    await updateCartDetails(client, 'cart_1', update)

    expect(calls[0]?.init).toMatchObject({ method: 'POST', body: update })
  })

  it('passes the checkout-check problem on and ok as null', async () => {
    const ok = fakeClient({ 'POST /store/carts/cart_1/checkout-check': { ok: true } })
    const blocked = fakeClient({
      'POST /store/carts/cart_1/checkout-check': {
        ok: false,
        field: 'delivery',
        message: 'Wybierz paczkomat.',
      },
    })

    expect(await runCheckoutCheck(ok.client, 'cart_1')).toBeNull()
    expect(await runCheckoutCheck(blocked.client, 'cart_1')).toEqual({
      field: 'delivery',
      message: 'Wybierz paczkomat.',
    })
  })
})

describe('payments', () => {
  it('needs all three Stripe providers and the publishable key', () => {
    expect(paymentAvailability(STRIPE_PROVIDERS, 'pk_test_x')).toBe(true)
    expect(paymentAvailability(STRIPE_PROVIDERS, undefined)).toBe(false)
    expect(paymentAvailability(STRIPE_PROVIDERS, '')).toBe(false)
    expect(paymentAvailability(['pp_system_default'], 'pk_test_x')).toBe(false)
    expect(paymentAvailability(['pp_system_default'], undefined)).toBe(false)
  })

  it('lists the region providers', async () => {
    const { client, calls } = fakeClient({
      'GET /store/payment-providers': { payment_providers: [{ id: 'pp_stripe_stripe' }] },
    })

    expect(await fetchPaymentProviders(client, 'reg_1')).toEqual(['pp_stripe_stripe'])
    expect(calls[0]?.init?.query).toEqual({ region_id: 'reg_1' })
  })

  it('creates the collection when missing and returns the client secret of the method', async () => {
    const session = (provider_id: string) => ({
      payment_collection: {
        id: 'paycol_1',
        payment_sessions: [{ provider_id, data: { client_secret: 'pi_1_secret_x' } }],
      },
    })
    const { client, calls } = fakeClient({
      'POST /store/payment-collections': { payment_collection: { id: 'paycol_1' } },
      'POST /store/payment-collections/paycol_1/payment-sessions': () => {
        const body = calls.at(-1)?.init?.body as { provider_id: string }
        return session(body.provider_id)
      },
    })

    expect(await createPaymentSession(client, { id: 'cart_1' }, 'card')).toEqual({
      provider: 'pp_stripe_stripe',
      clientSecret: 'pi_1_secret_x',
    })
    expect(calls.map((c) => [c.path, c.init?.body])).toEqual([
      ['/store/payment-collections', { cart_id: 'cart_1' }],
      [
        '/store/payment-collections/paycol_1/payment-sessions',
        { provider_id: 'pp_stripe_stripe', data: { payment_method_types: ['card'] } },
      ],
    ])

    const existing = { id: 'cart_1', payment_collection: { id: 'paycol_1' } }
    expect((await createPaymentSession(client, existing, 'blik')).provider).toBe(
      'pp_stripe-blik_stripe',
    )
    expect((await createPaymentSession(client, existing, 'p24')).provider).toBe(
      'pp_stripe-przelewy24_stripe',
    )
    expect(calls.filter((c) => c.path === '/store/payment-collections')).toHaveLength(1)
  })
})

describe('completeCart', () => {
  it('returns the order id, or a Polish message when Medusa keeps the cart', async () => {
    const placed = fakeClient({
      'POST /store/carts/cart_1/complete': { type: 'order', order: { id: 'order_1' } },
    })
    const kept = fakeClient({
      'POST /store/carts/cart_1/complete': {
        type: 'cart',
        cart: { id: 'cart_1' },
        error: { message: 'Payment authorization failed' },
      },
    })
    const failed = fakeClient({
      'POST /store/carts/cart_1/complete': () => {
        throw httpError(500, 'boom')
      },
    })

    expect(await completeCart(placed.client, 'cart_1')).toEqual({ ok: true, orderId: 'order_1' })
    expect(await completeCart(kept.client, 'cart_1')).toEqual({
      ok: false,
      message: 'Płatność nie została potwierdzona. Spróbuj ponownie albo wybierz inną metodę.',
    })
    expect(await completeCart(failed.client, 'cart_1')).toEqual({
      ok: false,
      message: 'Nie udało się złożyć zamówienia. Spróbuj ponownie.',
    })
  })
})

describe('fetchOrderSummary', () => {
  it('sends the cart id only when there is one; unknown order is null', async () => {
    const { client, calls } = fakeClient({
      'GET /store/checkout/orders/order_1': { order: { id: 'order_1', display_id: 7 } },
      'GET /store/checkout/orders/order_x': () => {
        throw httpError(404, 'Nie znaleziono zamówienia.')
      },
    })

    await fetchOrderSummary(client, 'order_1', 'cart_1')
    await fetchOrderSummary(client, 'order_1', null)
    expect(await fetchOrderSummary(client, 'order_x', null)).toBeNull()

    expect(calls.map((c) => c.init?.query)).toEqual([{ cart_id: 'cart_1' }, undefined, undefined])
    expect(calls[0]?.init?.cache).toBe('no-store')
  })
})

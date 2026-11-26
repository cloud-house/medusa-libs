import { Modules } from '@medusajs/framework/utils'
import { medusaIntegrationTestRunner } from '@medusajs/test-utils'
import { createStore, type TestStore } from '../helpers/admin'
import { type CheckoutShop, setupCheckoutShop } from '../helpers/checkout'
import { send } from '../helpers/customer'
import { waitForNotifications } from '../helpers/notifications'
import { placeOrder } from '../helpers/orders'

jest.setTimeout(240 * 1000)

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe('medusa-checkout-pl', () => {
      let store: TestStore
      let shop: CheckoutShop
      let headers: Record<string, string>

      beforeEach(async () => {
        const container = getContainer()
        store = await createStore(container)
        headers = { 'x-publishable-api-key': store.publishableKey }
        shop = await setupCheckoutShop(container, store)
      })

      const cartWith = async (variantId: string, quantity = 1, phone = '+48600100200') => {
        const id: string = (
          await api.post(
            '/store/carts',
            { region_id: store.regionId, shipping_address: { country_code: 'pl', phone } },
            { headers },
          )
        ).data.cart.id
        await send(
          api.post(
            `/store/carts/${id}/line-items`,
            { variant_id: variantId, quantity },
            { headers },
          ),
        )
        return id
      }
      const ship = (cartId: string, code: string, data?: Record<string, unknown>) =>
        send(
          api.post(
            `/store/carts/${cartId}/shipping-methods`,
            { option_id: shop.options[code], ...(data ? { data } : {}) },
            { headers },
          ),
        )
      const get = (url: string) => send(api.get(url, { headers }))
      const check = (cartId: string) =>
        send(api.post(`/store/carts/${cartId}/checkout-check`, {}, { headers }))

      it('GET /store/shipping-rates: methods by price with the free-shipping threshold', async () => {
        const { data } = await get('/store/shipping-rates')
        expect(
          data.rates.map((r: { code: string; amount: number; free_from: number | null }) => [
            r.code,
            r.amount,
            r.free_from,
          ]),
        ).toEqual([
          ['paczkomat-inpost', 12.99, 500],
          ['kurier-inpost', 15.99, 500],
          ['kurier-dpd', 16.99, 500],
        ])
      })

      it('delivery options: in the configured order, all open for a plain product', async () => {
        const cart = await cartWith(shop.variants.chair)
        const { data } = await get(`/store/carts/${cart}/delivery-options`)
        expect(
          data.options.map((o: { code: string; available: boolean }) => [o.code, o.available]),
        ).toEqual([
          ['kurier-inpost', true],
          ['kurier-dpd', true],
          ['paczkomat-inpost', true],
        ])
      })

      it('delivery options: a product with a parcel class closes both InPost methods with the reason', async () => {
        const cart = await cartWith(shop.variants.sofa)
        const { data } = await get(`/store/carts/${cart}/delivery-options`)
        const byCode = Object.fromEntries(data.options.map((o: { code: string }) => [o.code, o]))
        expect(byCode['kurier-dpd']).toMatchObject({ available: true, reason: null })
        expect(byCode['kurier-inpost']).toMatchObject({
          available: false,
          reason: 'sofa wysyłamy tylko kurierem DPD.',
        })
        expect(byCode['paczkomat-inpost']).toMatchObject({
          available: false,
          reason: 'sofa nie mieści się w paczkomacie.',
        })
      })

      it('the shipping method hook refuses a bulky item in a locker or the InPost courier', async () => {
        const cart = await cartWith(shop.variants.sofa)
        const locker = await ship(cart, 'paczkomat-inpost', { parcel_locker: 'KRA01M' })
        expect(locker.status).toBe(400)
        expect(locker.data.message).toBe(
          'Paczkomat jest niedostępny dla tych produktów – wybierz kuriera. sofa nie mieści się w paczkomacie.',
        )
        const courier = await ship(cart, 'kurier-inpost')
        expect(courier.status).toBe(400)
        expect(courier.data.message).toBe(
          'Kurier InPost jest niedostępny dla tych produktów – wybierz Kuriera DPD. sofa wysyłamy tylko kurierem DPD.',
        )
        expect((await ship(cart, 'kurier-dpd')).status).toBe(200)
      })

      it('checkout-check: delivery, locker point, mobile number', async () => {
        const cart = await cartWith(shop.variants.chair)
        expect((await check(cart)).data).toEqual({
          ok: false,
          field: 'delivery',
          message: 'Wybierz sposób dostawy.',
        })
        expect((await ship(cart, 'paczkomat-inpost')).status).toBe(200)
        expect((await check(cart)).data).toEqual({
          ok: false,
          field: 'delivery',
          message: 'Wybierz paczkomat.',
        })
        const landline = await cartWith(shop.variants.chair, 1, '+48221234567')
        await ship(landline, 'paczkomat-inpost', { parcel_locker: 'KRA01M' })
        const result = await check(landline)
        expect(result.status).toBe(200)
        expect(result.data).toMatchObject({ ok: false, field: 'delivery' })
        const ok = await cartWith(shop.variants.chair)
        await ship(ok, 'paczkomat-inpost', { parcel_locker: 'KRA01M' })
        expect((await check(ok)).data).toEqual({ ok: true })
      })

      it('the stock hook refuses more than is in stock and names the product', async () => {
        const cart = await cartWith(shop.variants.scarce, 1)
        const over = await send(
          api.post(
            `/store/carts/${cart}/line-items`,
            { variant_id: shop.variants.scarce, quantity: 5 },
            { headers },
          ),
        )
        expect(over.status).toBe(400)
        expect(over.data.message).toBe('scarce: mamy tylko 1 szt.')
      })

      it('the order for the confirmation page: only the id without the cart, full with it; a guest cannot read /store/orders/:id', async () => {
        const { orderId, cartId } = await placeOrder(getContainer(), {
          email: 'jan@example.pl',
          regionId: store.regionId,
        })
        const reference = await get(`/store/checkout/orders/${orderId}`)
        expect(Object.keys(reference.data.order).sort()).toEqual(['display_id', 'id'])

        const full = await api.get(`/store/checkout/orders/${orderId}?cart_id=${cartId}`, {
          headers,
        })
        expect(full.data.order).toMatchObject({ id: orderId, email: 'jan@example.pl' })
        expect(full.data.has_account).toBe(false)

        const other = await api.get(`/store/checkout/orders/${orderId}?cart_id=cart_other`, {
          headers,
        })
        expect(Object.keys(other.data.order).sort()).toEqual(['display_id', 'id'])

        const guest = await send(api.get(`/store/orders/${orderId}`, { headers }))
        expect(guest.status).toBe(404)
        expect(guest.data.message).toBe('Nie znaleziono zamówienia.')
      })

      it('order.placed: a bulky item in a parcel locker order is flagged and the confirmation e-mail goes out once', async () => {
        const container = getContainer()
        const { orderId } = await placeOrder(container, {
          email: 'jan@example.pl',
          regionId: store.regionId,
          items: [
            { title: 'sofa', quantity: 1, unit_price: 1000, product_id: shop.productIds.sofa },
          ],
          shippingOptionId: shop.options['paczkomat-inpost'],
        })
        const [notification] = await waitForNotifications(
          container,
          'jan@example.pl',
          'order-placed',
        )
        expect(notification?.status).toBe('success')
        expect(notification?.data).toMatchObject({
          delivery: { note: expect.stringContaining('paczkomacie') },
        })

        const [order] = await container.resolve(Modules.ORDER).listOrders({ id: orderId })
        expect(order?.metadata?.delivery_review).toBe('board_to_parcel_locker')
      })
    })
  },
})

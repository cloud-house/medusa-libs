import type { CreateOrderDTO, MedusaContainer } from '@medusajs/framework/types'
import { Modules } from '@medusajs/framework/utils'
import { medusaIntegrationTestRunner } from '@medusajs/test-utils'
import { createStore, type TestStore } from '../helpers/admin'
import { issuedAt, type RegisteredCustomer, registerCustomer, send } from '../helpers/customer'
import { placeOrder } from '../helpers/orders'

jest.setTimeout(240 * 1000)

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe('customer sessions, protected fields and the shop’s own account routes', () => {
      let container: MedusaContainer
      let store: TestStore
      let headers: Record<string, string>
      let customer: RegisteredCustomer

      const staleToken = () =>
        container.resolve(Modules.CUSTOMER).updateCustomers(customer.customerId, {
          metadata: { sessions_valid_from: issuedAt(customer.token) + 1 },
        })

      beforeEach(async () => {
        container = getContainer()
        store = await createStore(container)
        headers = { 'x-publishable-api-key': store.publishableKey }
        customer = await registerCustomer(api, headers, { email: 'anna@example.com' })
      })

      it('a token issued before „sessions valid from” is 401 on the customer routes', async () => {
        expect(
          (await send(api.get('/store/customers/me', { headers: customer.authHeaders }))).status,
        ).toBe(200)

        await staleToken()

        const me = await send(api.get('/store/customers/me', { headers: customer.authHeaders }))
        expect(me.status).toBe(401)
        expect(me.data).toEqual({
          type: 'unauthorized',
          message: 'Sesja wygasła. Zaloguj się ponownie.',
        })
        expect(
          (await send(api.get('/store/orders', { headers: customer.authHeaders }))).status,
        ).toBe(401)
        expect(
          (await send(api.get('/store/account/profile', { headers: customer.authHeaders }))).status,
        ).toBe(401)
      })

      it('a customer token cannot be refreshed or turned into a session', async () => {
        await staleToken()
        const bearer = { headers: { authorization: `Bearer ${customer.token}` } }
        expect((await send(api.post('/auth/token/refresh', {}, bearer))).status).toBe(404)
        expect((await send(api.post('/auth/session', {}, bearer))).status).toBe(404)
      })

      it('Medusa’s own customer registration is closed', async () => {
        expect(
          (
            await send(
              api.post('/auth/customer/emailpass/register', {
                email: 'native@example.com',
                password: 'secret-password-1',
              }),
            )
          ).status,
        ).toBe(404)
        expect(
          (await send(api.post('/store/customers', { email: 'victim@example.com' }, { headers })))
            .status,
        ).toBe(404)
        expect(
          (await send(api.get('/store/customers/me', { headers: customer.authHeaders }))).status,
        ).toBe(200)
      })

      it('a customer cannot write the account metadata through the Store API', async () => {
        const response = await send(
          api.post(
            '/store/customers/me',
            { metadata: { sessions_valid_from: 0 } },
            { headers: customer.authHeaders },
          ),
        )
        expect(response.status).toBe(400)
        expect(response.data).toEqual({
          type: 'invalid_data',
          message: 'Pole metadata jest niedostępne.',
        })
        // Other fields still go through.
        const named = await send(
          api.post(
            '/store/customers/me',
            { first_name: 'Hanna' },
            { headers: customer.authHeaders },
          ),
        )
        expect(named.status).toBe(200)
      })

      it('Medusa’s own verification routes are not reachable from outside', async () => {
        const response = await send(
          api.post(
            '/auth/verification/request',
            { entity_id: 'stranger@example.com', entity_type: 'email' },
            { headers: customer.authHeaders },
          ),
        )
        expect(response.status).toBe(404)
        expect(response.data).toEqual({ type: 'not_found', message: 'Nie znaleziono.' })
      })

      describe('a shop route under /store/account that uses ownOrder', () => {
        const order = (id: string, authHeaders: Record<string, string>) =>
          send(api.get(`/store/account/orders/${id}`, { headers: authHeaders }))

        it('returns the order of the signed-in customer', async () => {
          const { orderId } = await placeOrder(container, {
            email: 'anna@example.com',
            regionId: store.regionId,
            customerId: customer.customerId,
          })
          const response = await order(orderId, customer.authHeaders)
          expect(response.status).toBe(200)
          expect(response.data.order).toEqual({ id: orderId, display_id: expect.any(Number) })
        })

        it("returns 404 for another customer's order via ownOrder", async () => {
          const other = await registerCustomer(api, headers, { email: 'other@example.com' })
          const { orderId } = await placeOrder(container, {
            email: 'other@example.com',
            regionId: store.regionId,
            customerId: other.customerId,
          })
          const response = await order(orderId, customer.authHeaders)
          expect(response.status).toBe(404)
          expect(response.data).toEqual({
            type: 'not_found',
            message: 'Nie znaleziono zamówienia.',
          })
          expect((await order('order_nope', customer.authHeaders)).status).toBe(404)
        })

        it('is not served to a draft order or to a guest order', async () => {
          // The Order module takes `is_draft_order`, the DTO type does not list it.
          const draft = await container.resolve(Modules.ORDER).createOrders({
            region_id: store.regionId,
            currency_code: 'pln',
            email: 'anna@example.com',
            customer_id: customer.customerId,
            is_draft_order: true,
            items: [{ title: 'Test item', quantity: 1, unit_price: 1000 }],
          } as CreateOrderDTO)
          expect((await order(draft.id, customer.authHeaders)).status).toBe(404)

          const guest = await placeOrder(container, {
            email: 'guest@example.com',
            regionId: store.regionId,
          })
          expect((await order(guest.orderId, customer.authHeaders)).status).toBe(404)
        })

        it('needs a signed-in customer, and the plugin session guard covers the shop route', async () => {
          const { orderId } = await placeOrder(container, {
            email: 'anna@example.com',
            regionId: store.regionId,
            customerId: customer.customerId,
          })
          expect((await order(orderId, headers)).status).toBe(401)

          // The route and its `authenticate` are the shop's; `/store/account*` is the plugin's.
          await staleToken()
          const stale = await order(orderId, customer.authHeaders)
          expect(stale.status).toBe(401)
          expect(stale.data).toEqual({
            type: 'unauthorized',
            message: 'Sesja wygasła. Zaloguj się ponownie.',
          })
        })
      })
    })
  },
})

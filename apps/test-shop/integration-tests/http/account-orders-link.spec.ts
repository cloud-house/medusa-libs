import type { MedusaContainer } from '@medusajs/framework/types'
import { Modules } from '@medusajs/framework/utils'
import { medusaIntegrationTestRunner } from '@medusajs/test-utils'
import { createStore, type TestStore } from '../helpers/admin'
import { login, registerCustomer, send, sleep, TEST_PASSWORD } from '../helpers/customer'
import { linkParam, waitForNotifications } from '../helpers/notifications'
import { customerOrderIds, orderCustomer, placeOrder } from '../helpers/orders'

jest.setTimeout(240 * 1000)

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe('guest orders and the account', () => {
      let container: MedusaContainer
      let store: TestStore
      let headers: Record<string, string>

      const guestOrder = (email: string) =>
        placeOrder(container, { email, regionId: store.regionId })

      async function confirmEmail(email: string, authHeaders: Record<string, string>) {
        const [notification] = await waitForNotifications(container, email, 'email-confirmation')
        const code = linkParam(notification, 'kod')
        return (await api.post('/store/account/confirm-email', { code }, { headers: authHeaders }))
          .data
      }

      beforeEach(async () => {
        container = getContainer()
        store = await createStore(container)
        headers = { 'x-publishable-api-key': store.publishableKey }
      })

      it('after the e-mail confirmation the earlier guest orders join the account', async () => {
        const first = await guestOrder('x@example.com')
        const second = await guestOrder('x@example.com')
        const customer = await registerCustomer(api, headers, { email: 'x@example.com' })
        expect(await customerOrderIds(api, customer.authHeaders)).toEqual([])

        expect(await confirmEmail('x@example.com', customer.authHeaders)).toEqual({ linked: 2 })
        expect(await customerOrderIds(api, customer.authHeaders)).toEqual(
          [first.orderId, second.orderId].sort(),
        )
      })

      it('B: an account with an unconfirmed e-mail does not get a guest order on that e-mail', async () => {
        const customer = await registerCustomer(api, headers, { email: 'y@example.com' })
        // Medusa matches the cart e-mail to the account itself – the plugin takes the order back.
        const { orderId } = await placeOrder(container, {
          email: 'y@example.com',
          regionId: store.regionId,
          customerId: customer.customerId,
        })

        const owner = await orderCustomer(container, orderId, (c) => c?.has_account === false)
        expect(owner?.has_account).toBe(false)
        expect(await customerOrderIds(api, customer.authHeaders)).toEqual([])
      })

      it('A: a cart attached by the signed-in customer stays on the unconfirmed account', async () => {
        const customer = await registerCustomer(api, headers, { email: 'a@example.com' })
        const { orderId } = await placeOrder(container, {
          email: 'a@example.com',
          regionId: store.regionId,
          customerId: customer.customerId,
          cartMetadata: { account_customer_id: customer.customerId },
        })

        await sleep(1500)
        expect((await orderCustomer(container, orderId))?.id).toBe(customer.customerId)
        expect(await customerOrderIds(api, customer.authHeaders)).toEqual([orderId])
      })

      it('an account cart with another e-mail (the session ended, someone else buys): not in the account', async () => {
        const customer = await registerCustomer(api, headers, { email: 'old@example.com' })
        const { orderId } = await placeOrder(container, {
          email: 'new-guest@example.com',
          regionId: store.regionId,
          customerId: customer.customerId,
          cartMetadata: { account_customer_id: customer.customerId },
        })
        const owner = await orderCustomer(container, orderId, (c) => c?.has_account === false)
        expect(owner?.has_account).toBe(false)
        expect(await customerOrderIds(api, customer.authHeaders)).toEqual([])
      })

      it('C: a guest order on the confirmed e-mail of an account goes to the account', async () => {
        const earlier = await guestOrder('z@example.com')
        const customer = await registerCustomer(api, headers, { email: 'z@example.com' })
        expect(await confirmEmail('z@example.com', customer.authHeaders)).toEqual({ linked: 1 })

        const later = await guestOrder('z@example.com')
        const owner = await orderCustomer(
          container,
          later.orderId,
          (c) => c?.id === customer.customerId,
        )
        expect(owner?.id).toBe(customer.customerId)
        expect(await customerOrderIds(api, customer.authHeaders)).toEqual(
          [earlier.orderId, later.orderId].sort(),
        )
      })

      it('an account from the order: the order joins it at once and the confirmation link goes out', async () => {
        const { orderId, cartId } = await guestOrder('w@example.com')

        const wrong = await send(
          api.post(
            '/store/account/register-from-order',
            { order_id: orderId, cart_id: 'cart_wrong', password: TEST_PASSWORD },
            { headers },
          ),
        )
        expect(wrong.status).toBe(404)
        expect(wrong.data).toMatchObject({
          type: 'not_found',
          message: 'Nie znaleziono zamówienia.',
          code: 'account_order_not_found',
        })

        const created = await send(
          api.post(
            '/store/account/register-from-order',
            { order_id: orderId, cart_id: cartId, password: TEST_PASSWORD },
            { headers },
          ),
        )
        expect(created.status).toBe(201)
        expect(created.data.customer.email).toBe('w@example.com')

        const [account] = await container
          .resolve(Modules.CUSTOMER)
          .listCustomers({ email: 'w@example.com', has_account: true })
        expect(account).toMatchObject({
          first_name: 'Jan',
          last_name: 'Kowalski',
          phone: '+48600100200',
        })

        const token = await login(api, 'w@example.com')
        expect(
          await customerOrderIds(api, { ...headers, authorization: `Bearer ${token}` }),
        ).toEqual([orderId])
        expect(
          await waitForNotifications(container, 'w@example.com', 'email-confirmation'),
        ).toHaveLength(1)

        const again = await send(
          api.post(
            '/store/account/register-from-order',
            { order_id: orderId, cart_id: cartId, password: TEST_PASSWORD },
            { headers },
          ),
        )
        expect(again.status).toBe(422)
        expect(again.data.message).toBe('Konto z tym adresem już istnieje.')
      })
    })
  },
})

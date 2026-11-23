import { accountIdentityId } from '@cloud-house/medusa-accounts'
import type { MedusaContainer } from '@medusajs/framework/types'
import { generateJwtToken, Modules } from '@medusajs/framework/utils'
import { medusaIntegrationTestRunner } from '@medusajs/test-utils'
import { createStore, type TestStore } from '../helpers/admin'
import { login, registerCustomer, send, sleep, TEST_PASSWORD } from '../helpers/customer'
import { linkParam, notificationsAfterPause, waitForNotifications } from '../helpers/notifications'
import { customerOrderIds, placeOrder } from '../helpers/orders'

jest.setTimeout(240 * 1000)

const NEW_PASSWORD = 'new-password-22'

// medusa-config.ts: emailThrottle { max: 2 } for the account e-mails.
const THROTTLE = 2

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe('password, sessions and account deletion', () => {
      let container: MedusaContainer
      let store: TestStore
      let headers: Record<string, string>

      const bearer = (token: string) => ({ ...headers, authorization: `Bearer ${token}` })
      const me = (token: string) => send(api.get('/store/customers/me', { headers: bearer(token) }))
      const requestReset = (identifier: string) =>
        api.post('/auth/customer/emailpass/reset-password', { identifier })

      beforeEach(async () => {
        container = getContainer()
        store = await createStore(container)
        headers = { 'x-publishable-api-key': store.publishableKey }
      })

      it('reset: a mail with the link, one notification per token, no mail for an unknown e-mail', async () => {
        await registerCustomer(api, headers, { email: 'r@example.com', first_name: 'Rita' })
        const request = await send(requestReset('r@example.com'))
        expect(request.status).toBe(201)
        const [mail] = await waitForNotifications(container, 'r@example.com', 'password-reset')
        expect(mail?.status).toBe('success')
        expect((mail?.data as { firstName?: string } | undefined)?.firstName).toBe('Rita')
        expect((mail?.data as { actionUrl?: string } | undefined)?.actionUrl).toContain(
          'https://shop.test/reset-password?token=',
        )
        const token = linkParam(mail, 'token')

        // The same event again (same token) sends no second mail.
        await container.resolve(Modules.EVENT_BUS).emit({
          name: 'auth.password_reset',
          data: { entity_id: 'r@example.com', actor_type: 'customer', token, metadata: {} },
        })
        expect(
          await notificationsAfterPause(container, 'r@example.com', 'password-reset'),
        ).toHaveLength(1)

        const unknown = await send(requestReset('nobody@example.com'))
        expect(unknown.status).toBe(201)
        expect(
          await notificationsAfterPause(container, 'nobody@example.com', 'password-reset'),
        ).toHaveLength(0)
      })

      it('throttles the third password reset request within the window', async () => {
        await registerCustomer(api, headers, { email: 'spam@example.com' })
        // Medusa's own route looks the identity up by the exact identifier, so it never emits the
        // event for a differently spelled address; the later two requests are the same event as
        // the route emits, with the address spelled in capitals and spaces: one counter for all.
        const fakeToken = (jti: string) =>
          `h.${Buffer.from(JSON.stringify({ jti })).toString('base64url')}.s`
        const emit = (entity_id: string, jti: string) =>
          container.resolve(Modules.EVENT_BUS).emit({
            name: 'auth.password_reset',
            data: { entity_id, actor_type: 'customer', token: fakeToken(jti), metadata: {} },
          })

        expect((await send(requestReset('spam@example.com'))).status).toBe(201)
        await waitForNotifications(container, 'spam@example.com', 'password-reset')
        await emit(' SPAM@example.com ', 'second')
        await waitForNotifications(container, 'spam@example.com', 'password-reset', 2)
        await emit('Spam@Example.com', 'third')

        const sent = await notificationsAfterPause(container, 'spam@example.com', 'password-reset')
        expect(sent).toHaveLength(THROTTLE)
        expect(
          await notificationsAfterPause(container, ' spam@example.com ', 'password-reset'),
        ).toHaveLength(0)
      })

      it('a new password from the link, then end-others: the old token is 401, the new one 200', async () => {
        const customer = await registerCustomer(api, headers, { email: 's@example.com' })
        await requestReset('s@example.com')
        const [mail] = await waitForNotifications(container, 's@example.com', 'password-reset')

        const update = await send(
          api.post(
            '/auth/customer/emailpass/update',
            { password: NEW_PASSWORD },
            { headers: { authorization: `Bearer ${linkParam(mail, 'token')}` } },
          ),
        )
        expect(update.status).toBe(200)

        await sleep(1100) // the new token needs a later iat than the old one
        const fresh = await login(api, 's@example.com', NEW_PASSWORD)
        expect(
          (
            await send(
              api.post('/store/account/sessions/end-others', {}, { headers: bearer(fresh) }),
            )
          ).status,
        ).toBe(200)
        expect((await me(customer.token)).status).toBe(401)
        expect((await me(fresh)).status).toBe(200)
      })

      it('end-others without a token issue time is 400', async () => {
        const customer = await registerCustomer(api, headers, { email: 'iat@example.com' })
        expect((await me(customer.token)).status).toBe(200)
        // A token that Medusa accepts but that has no `iat`.
        const authIdentityId = await accountIdentityId(container, customer.customerId)
        const noIat = generateJwtToken(
          {
            actor_id: customer.customerId,
            actor_type: 'customer',
            auth_identity_id: authIdentityId,
            app_metadata: { customer_id: customer.customerId },
          },
          { secret: process.env.JWT_SECRET, expiresIn: '1d', jwtOptions: { noTimestamp: true } },
        )
        const response = await send(
          api.post('/store/account/sessions/end-others', {}, { headers: bearer(noIat) }),
        )
        expect(response.status).toBe(400)
        expect(response.data).toEqual({
          type: 'invalid_data',
          message: 'Brak czasu wydania tokenu.',
        })
      })

      it('changing the password: a wrong current one is 400, a right one ends the old token', async () => {
        const customer = await registerCustomer(api, headers, { email: 't@example.com' })
        const wrong = await send(
          api.post(
            '/store/account/password',
            { current_password: 'wrong-password-1', new_password: NEW_PASSWORD },
            { headers: customer.authHeaders },
          ),
        )
        expect(wrong.status).toBe(400)
        expect(wrong.data).toEqual({
          type: 'invalid_data',
          message: 'Obecne hasło jest nieprawidłowe.',
        })

        await sleep(1100)
        const changed = await send(
          api.post(
            '/store/account/password',
            { current_password: TEST_PASSWORD, new_password: NEW_PASSWORD },
            { headers: customer.authHeaders },
          ),
        )
        expect(changed.status).toBe(200)
        expect(changed.data).toEqual({ success: true })
        expect((await me(customer.token)).status).toBe(401)
        const fresh = await login(api, 't@example.com', NEW_PASSWORD)
        expect((await me(fresh)).status).toBe(200)
      })

      it('the profile shows the customer and the confirmation flag', async () => {
        const customer = await registerCustomer(api, headers, {
          email: 'p@example.com',
          first_name: 'Ola',
        })
        const profile = await send(
          api.get('/store/account/profile', { headers: customer.authHeaders }),
        )
        expect(profile.status).toBe(200)
        expect(profile.data.customer).toEqual({
          id: customer.customerId,
          email: 'p@example.com',
          first_name: 'Ola',
          last_name: 'Kowalski',
          phone: '600100200',
          email_confirmed: false,
        })
        expect((await send(api.get('/store/account/profile', { headers }))).status).toBe(401)
      })

      it('deleting the account: data and addresses go, the order stays and returns after re-registering', async () => {
        const customer = await registerCustomer(api, headers, {
          email: 'u@example.com',
          first_name: 'Ula',
          phone: '+48600999888',
        })
        await api.post(
          '/store/customers/me/addresses',
          {
            first_name: 'Ula',
            last_name: 'Kowalska',
            address_1: 'ul. Morska 1',
            postal_code: '80-001',
            city: 'Gdańsk',
            country_code: 'pl',
          },
          { headers: customer.authHeaders },
        )
        const { orderId } = await placeOrder(container, {
          email: 'u@example.com',
          regionId: store.regionId,
          customerId: customer.customerId,
          cartMetadata: { account_customer_id: customer.customerId },
        })
        await sleep(1000)
        expect(await customerOrderIds(api, customer.authHeaders)).toEqual([orderId])

        // The account's open cart on another device.
        const openCart: string = (
          await api.post('/store/carts', { region_id: store.regionId }, { headers })
        ).data.cart.id
        const attached = await send(
          api.post('/store/account/cart', { cart_id: openCart }, { headers: customer.authHeaders }),
        )
        expect(attached.data).toEqual({ cart_id: openCart })
        expect(
          (await api.get('/store/account/cart', { headers: customer.authHeaders })).data,
        ).toEqual({ cart_id: openCart })

        const wrong = await send(
          api.post(
            '/store/account/delete',
            { password: 'wrong-password-1' },
            { headers: customer.authHeaders },
          ),
        )
        expect(wrong.status).toBe(400)
        expect(wrong.data).toEqual({ type: 'invalid_data', message: 'Nieprawidłowe hasło.' })

        const deleted = await send(
          api.post(
            '/store/account/delete',
            { password: TEST_PASSWORD },
            { headers: customer.authHeaders },
          ),
        )
        expect(deleted.status).toBe(200)
        expect(deleted.data).toEqual({ deleted: true })
        expect((await me(customer.token)).status).toBe(401)
        // `onAccountDeleted` of medusa-config.ts ran with this customer.
        expect((globalThis as { deletedAccounts?: string[] }).deletedAccounts).toContain(
          customer.customerId,
        )

        const relogin = await send(
          api.post('/auth/customer/emailpass', { email: 'u@example.com', password: TEST_PASSWORD }),
        )
        expect(relogin.status).toBe(401)

        const [row] = await container
          .resolve(Modules.CUSTOMER)
          .listCustomers(
            { id: customer.customerId },
            { withDeleted: true, relations: ['addresses'] },
          )
        expect(row?.deleted_at).toBeTruthy()
        expect(row).toMatchObject({ first_name: null, last_name: null, phone: null })
        expect(row?.email).toBe(`deleted+${customer.customerId}@account-deleted.invalid`)
        expect(row?.addresses ?? []).toHaveLength(0)
        expect(await container.resolve(Modules.CART).listCarts({ id: openCart })).toHaveLength(0)

        const [order] = await container
          .resolve(Modules.ORDER)
          .listOrders({ id: orderId }, { select: ['id', 'email'] })
        expect(order?.email).toBe('u@example.com')

        const again = await registerCustomer(api, headers, { email: 'u@example.com' })
        const mails = await waitForNotifications(
          container,
          'u@example.com',
          'email-confirmation',
          2,
        )
        const code = linkParam(mails[mails.length - 1], 'kod')
        expect(
          (await api.post('/store/account/confirm-email', { code }, { headers: again.authHeaders }))
            .data,
        ).toEqual({ linked: 1 })
        expect(await customerOrderIds(api, again.authHeaders)).toEqual([orderId])
      })

      it('the account cart route: an unknown cart is 404 and the last cart is empty', async () => {
        const customer = await registerCustomer(api, headers, { email: 'c@example.com' })
        const unknown = await send(
          api.post(
            '/store/account/cart',
            { cart_id: 'cart_nope' },
            { headers: customer.authHeaders },
          ),
        )
        expect(unknown.status).toBe(404)
        expect(unknown.data).toEqual({ type: 'not_found', message: 'Nie znaleziono koszyka.' })
        expect(
          (await api.get('/store/account/cart', { headers: customer.authHeaders })).data,
        ).toEqual({ cart_id: null })
      })
    })
  },
})

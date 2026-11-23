import { createAccountFromCheckoutWorkflow, isEmailConfirmed } from '@cloud-house/medusa-accounts'
import { relinkCheckoutAccountStep } from '@cloud-house/medusa-accounts/workflows/account/create-account-from-checkout'
import type { MedusaContainer } from '@medusajs/framework/types'
import { Modules } from '@medusajs/framework/utils'
import { createStep, createWorkflow, WorkflowResponse } from '@medusajs/framework/workflows-sdk'
import { medusaIntegrationTestRunner } from '@medusajs/test-utils'
import { createStore, type TestStore } from '../helpers/admin'
import { login, registerCustomer, send } from '../helpers/customer'
import { linkParam, notificationsAfterPause, waitForNotifications } from '../helpers/notifications'
import { customerOrderIds, orderCustomer, placeOrder } from '../helpers/orders'

jest.setTimeout(240 * 1000)

const NEW_PASSWORD = 'New-password-1'
const DAY_MS = 24 * 60 * 60 * 1000
const EXPIRED_LINK_MESSAGE = 'Link wygasł albo został już użyty.'

// medusa-config.ts: emailThrottle { max: 2 } for the account e-mails.
const THROTTLE = 2

/** A step after the relink that fails – the workflow has to undo the relink. */
const failAfterRelinkStep = createStep('test-fail-after-relink', async () => {
  throw new Error('a later step failed')
})
const relinkThenFailWorkflow = createWorkflow(
  'test-relink-then-fail',
  (input: { orderId: string; customerId: string }) => {
    relinkCheckoutAccountStep(input)
    failAfterRelinkStep()
    return new WorkflowResponse(undefined)
  },
)

/** The module's generated update – not part of `IAuthModuleService`. */
type VerificationUpdates = {
  updateAuthVerifications(data: { id: string; requested_at: Date }): Promise<unknown>
}

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe('account created at the checkout', () => {
      let container: MedusaContainer
      let store: TestStore
      let headers: Record<string, string>

      const customers = () => container.resolve(Modules.CUSTOMER)

      /** A guest order; `createAccount` – the checkout's „create an account” box was ticked. */
      const order = (email: string, createAccount = true) =>
        placeOrder(container, {
          email,
          regionId: store.regionId,
          metadata: createAccount ? { create_account: 'tak' } : {},
        })

      const account = async (email: string) =>
        (await customers().listCustomers({ email, has_account: true }))[0]

      async function waitForAccount(email: string) {
        for (let i = 0; i < 50; i++) {
          const found = await account(email)
          if (found) return found
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
        return account(email)
      }

      const setPassword = (code: string, password = NEW_PASSWORD) =>
        send(api.post('/store/account/set-password', { code, password }, { headers }))

      beforeEach(async () => {
        container = getContainer()
        store = await createStore(container)
        headers = { 'x-publishable-api-key': store.publishableKey }
      })

      it('a new e-mail: an account waiting for a password, the order on it, the „set password” mail', async () => {
        const placed = await order('nowy@example.com')
        const created = await waitForAccount('nowy@example.com')
        expect(created?.metadata).toMatchObject({
          password_pending: true,
          created_from_order: placed.orderId,
        })
        expect(created).toMatchObject({ first_name: 'Jan', last_name: 'Kowalski' })
        const owner = await orderCustomer(container, placed.orderId, (c) => c?.id === created?.id)
        expect(owner?.id).toBe(created?.id)

        const [mail, ...rest] = await waitForNotifications(
          container,
          'nowy@example.com',
          'set-password',
        )
        expect(rest).toHaveLength(0)
        expect((mail?.data as { actionUrl?: string } | undefined)?.actionUrl).toContain(
          'https://shop.test/set-password?kod=',
        )
        expect(
          await notificationsAfterPause(container, 'nowy@example.com', 'email-confirmation'),
        ).toHaveLength(0)
      })

      it('a second order before the password is set: the same account, a new link, the old one stops working', async () => {
        await order('drugi@example.com')
        const created = await waitForAccount('drugi@example.com')
        const [first] = await waitForNotifications(container, 'drugi@example.com', 'set-password')
        const second = await order('drugi@example.com')
        await orderCustomer(container, second.orderId, (c) => c?.id === created?.id)
        const mails = await waitForNotifications(container, 'drugi@example.com', 'set-password', 2)
        expect(mails).toHaveLength(2)
        expect((await account('drugi@example.com'))?.metadata?.created_from_order).toBe(
          second.orderId,
        )

        expect((await setPassword(linkParam(first, 'kod'))).status).toBe(400)
        const done = await setPassword(linkParam(mails[1], 'kod'))
        expect(done.status).toBe(200)
        expect(done.data.email).toBe('drugi@example.com')
      })

      it('order.placed of the same order again: no new link, the e-mailed link works', async () => {
        const placed = await order('ponownie@example.com')
        await waitForAccount('ponownie@example.com')
        const [mail] = await waitForNotifications(container, 'ponownie@example.com', 'set-password')

        // A redelivered event (e.g. after a queue restart) runs the workflow a second time.
        const { result } = await createAccountFromCheckoutWorkflow(container).run({
          input: { orderId: placed.orderId },
        })
        expect(result.outcome).toBe('skipped')
        expect(
          await notificationsAfterPause(container, 'ponownie@example.com', 'set-password'),
        ).toHaveLength(1)
        expect((await setPassword(linkParam(mail, 'kod'))).status).toBe(200)
      })

      it('the relink is undone when a later step fails: the order customer and created_from_order come back', async () => {
        const first = await order('cofniecie@example.com')
        const created = await waitForAccount('cofniecie@example.com')
        await waitForNotifications(container, 'cofniecie@example.com', 'set-password')
        // An order without a customer (e.g. created outside a cart) must come back to its state too.
        const loose = await order('cofniecie@example.com', false)
        await orderCustomer(container, loose.orderId, (c) => c?.has_account === false)
        const orders = container.resolve(Modules.ORDER)
        const customerOf = async (orderId: string) =>
          (await orders.listOrders({ id: orderId }, { select: ['id', 'customer_id'] }))[0]
            ?.customer_id
        // The DTO type has no `null`, the module accepts it.
        await orders.updateOrders([{ id: loose.orderId, customer_id: null as unknown as string }])
        expect(await customerOf(loose.orderId)).toBeNull()

        const { errors } = await relinkThenFailWorkflow(container).run({
          input: { orderId: loose.orderId, customerId: created.id },
          throwOnError: false,
        })
        expect(errors.map((e) => e.error?.message)).toContain('a later step failed')

        expect(await customerOf(loose.orderId)).toBeNull()
        expect((await account('cofniecie@example.com'))?.metadata).toMatchObject({
          password_pending: true,
          created_from_order: first.orderId,
        })
      })

      it('setting the password: sign-in works, the e-mail is confirmed, earlier guest orders join', async () => {
        const earlier = await order('stary-gosc@example.com', false)
        const placed = await order('stary-gosc@example.com')
        const created = await waitForAccount('stary-gosc@example.com')
        const [mail] = await waitForNotifications(
          container,
          'stary-gosc@example.com',
          'set-password',
        )
        await orderCustomer(container, placed.orderId, (c) => c?.id === created?.id)

        const done = await setPassword(linkParam(mail, 'kod'))
        expect(done.status).toBe(200)
        expect(done.data).toEqual({ email: 'stary-gosc@example.com', linked: 1 })

        const token = await login(api, 'stary-gosc@example.com', NEW_PASSWORD)
        const auth = { headers: { ...headers, authorization: `Bearer ${token}` } }
        const profile = (await api.get('/store/account/profile', auth)).data.customer
        expect(profile.email_confirmed).toBe(true)
        expect(
          (await account('stary-gosc@example.com'))?.metadata?.password_pending,
        ).toBeUndefined()
        expect(await customerOrderIds(api, auth.headers)).toEqual(
          [earlier.orderId, placed.orderId].sort(),
        )
        expect((await setPassword(linkParam(mail, 'kod'))).status).toBe(400)
      })

      it('a „set password” link older than 7 days: expired, the account still waits for a password', async () => {
        await order('wygasly@example.com')
        await waitForAccount('wygasly@example.com')
        const [mail] = await waitForNotifications(container, 'wygasly@example.com', 'set-password')
        const auth = container.resolve(Modules.AUTH)
        const [verification] = await auth.listAuthVerifications({
          entity_id: 'wygasly@example.com',
          entity_type: 'email',
        })
        await (auth as unknown as VerificationUpdates).updateAuthVerifications({
          id: verification?.id as string,
          requested_at: new Date(Date.now() - 8 * DAY_MS),
        })

        const expired = await setPassword(linkParam(mail, 'kod'))
        expect(expired.status).toBe(400)
        expect(expired.data.message).toBe(EXPIRED_LINK_MESSAGE)
        expect((await account('wygasly@example.com'))?.metadata?.password_pending).toBe(true)
        expect(
          await send(
            api.post('/auth/customer/emailpass', {
              email: 'wygasly@example.com',
              password: NEW_PASSWORD,
            }),
          ),
        ).toMatchObject({ status: 401 })
      })

      it('a failed password write does not use up the link: the same link works again', async () => {
        await order('awaria@example.com')
        await waitForAccount('awaria@example.com')
        const [mail] = await waitForNotifications(container, 'awaria@example.com', 'set-password')
        const update = jest
          .spyOn(container.resolve(Modules.AUTH), 'updateProvider')
          .mockResolvedValueOnce({ success: false, error: 'provider unavailable' })

        const failed = await setPassword(linkParam(mail, 'kod'))
        update.mockRestore()
        expect(failed.status).toBe(500)
        expect((await account('awaria@example.com'))?.metadata?.password_pending).toBe(true)

        const done = await setPassword(linkParam(mail, 'kod'))
        expect(done.status).toBe(200)
        expect(await login(api, 'awaria@example.com', NEW_PASSWORD)).toEqual(expect.any(String))
      })

      it('an e-mail with a password account: no new account and no mail', async () => {
        const existing = await registerCustomer(api, headers, { email: 'ma-konto@example.com' })
        const placed = await order('ma-konto@example.com')
        expect(
          await notificationsAfterPause(container, 'ma-konto@example.com', 'set-password'),
        ).toHaveLength(0)
        const accounts = await customers().listCustomers({
          email: 'ma-konto@example.com',
          has_account: true,
        })
        expect(accounts.map((c) => c.id)).toEqual([existing.customerId])
        expect(accounts[0]?.metadata?.password_pending).toBeUndefined()
        // The account's e-mail is not confirmed – the guest order waits for the confirmation (rule A/B/C).
        const owner = await orderCustomer(container, placed.orderId)
        expect(owner?.id).not.toBe(existing.customerId)
        expect(owner?.has_account).toBe(false)
      })

      it('the code of a plain „confirm your e-mail” does not set a password', async () => {
        await registerCustomer(api, headers, { email: 'zwykly@example.com' })
        const [mail] = await waitForNotifications(
          container,
          'zwykly@example.com',
          'email-confirmation',
        )
        expect((await setPassword(linkParam(mail, 'kod'))).status).toBe(400)
        const found = await account('zwykly@example.com')
        expect(await isEmailConfirmed(container, found?.id as string)).toBe(false)
      })

      it('an admin login (an identity without a customer): no account and no mail', async () => {
        const auth = container.resolve(Modules.AUTH)
        const { authIdentity } = await auth.register('emailpass', {
          body: { email: 'admin-sklepu@example.com', password: 'admin-haslo-1' },
        } as never)
        // Tak oznacza go `createUserAccountWorkflow` Medusy.
        await auth.updateAuthIdentities([
          { id: authIdentity?.id as string, app_metadata: { user_id: 'user_admin' } },
        ])
        await order('admin-sklepu@example.com')
        expect(
          await notificationsAfterPause(container, 'admin-sklepu@example.com', 'set-password'),
        ).toHaveLength(0)
        expect(await account('admin-sklepu@example.com')).toBeUndefined()
        const [identity] = await auth.listAuthIdentities(
          { id: [authIdentity?.id as string] },
          { select: ['id', 'app_metadata'] },
        )
        expect(identity?.app_metadata).toEqual({ user_id: 'user_admin' })
      })

      it('an account waiting for a password + an order without the box: not on the account; joins after the password', async () => {
        await order('czeka@example.com')
        await waitForAccount('czeka@example.com')
        const [mail] = await waitForNotifications(container, 'czeka@example.com', 'set-password')
        const loose = await order('czeka@example.com', false)
        const owner = await orderCustomer(container, loose.orderId, (c) => c?.has_account === false)
        expect(owner?.has_account).toBe(false)
        const done = await setPassword(linkParam(mail, 'kod'))
        expect(done.data.linked).toBe(1)
      })

      it('the „set password” mails are throttled: the order after the limit is still on the account, the last code works', async () => {
        await order('limit@example.com')
        const created = await waitForAccount('limit@example.com')
        await waitForNotifications(container, 'limit@example.com', 'set-password', 1)
        await order('limit@example.com')
        const sent = await waitForNotifications(
          container,
          'limit@example.com',
          'set-password',
          THROTTLE,
        )
        const over = await order('limit@example.com')
        await orderCustomer(container, over.orderId, (c) => c?.id === created?.id)
        expect((await orderCustomer(container, over.orderId))?.id).toBe(created?.id)
        expect(
          await notificationsAfterPause(container, 'limit@example.com', 'set-password'),
        ).toHaveLength(THROTTLE)
        expect((await setPassword(linkParam(sent[THROTTLE - 1], 'kod'))).status).toBe(200)
      })

      it('reset + end-others on a checkout account: password_pending ends, the e-mail is confirmed, orders join', async () => {
        await order('reset@example.com')
        const created = await waitForAccount('reset@example.com')
        // An order without the box joins after the password reset.
        const loose = await order('reset@example.com', false)
        expect(
          (await orderCustomer(container, loose.orderId, (c) => c?.has_account === false))
            ?.has_account,
        ).toBe(false)
        await api.post('/auth/customer/emailpass/reset-password', {
          identifier: 'reset@example.com',
        })
        const [reset] = await waitForNotifications(container, 'reset@example.com', 'password-reset')
        await api.post(
          '/auth/customer/emailpass/update',
          { password: NEW_PASSWORD },
          { headers: { authorization: `Bearer ${linkParam(reset, 'token')}` } },
        )
        const token = await login(api, 'reset@example.com', NEW_PASSWORD)
        const auth = { headers: { ...headers, authorization: `Bearer ${token}` } }
        await api.post('/store/account/sessions/end-others', {}, auth)

        expect((await account('reset@example.com'))?.metadata?.password_pending).toBeUndefined()
        expect(await isEmailConfirmed(container, created.id)).toBe(true)
        expect((await orderCustomer(container, loose.orderId))?.id).toBe(created.id)
        const resend = await send(api.post('/store/account/email-confirmation', {}, auth))
        expect(resend.status).toBe(200)
        expect(resend.data).toEqual({ sent: false, confirmed: true })
        expect(
          await notificationsAfterPause(container, 'reset@example.com', 'email-confirmation'),
        ).toHaveLength(0)
      })

      it('end-others on a plain account does not confirm the e-mail', async () => {
        const regular = await registerCustomer(api, headers, { email: 'zwykle@example.com' })
        await api.post('/store/account/sessions/end-others', {}, { headers: regular.authHeaders })
        expect(await isEmailConfirmed(container, regular.customerId)).toBe(false)
      })
    })
  },
})

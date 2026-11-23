import { isEmailConfirmed } from '@cloud-house/medusa-accounts'
import type { MedusaContainer } from '@medusajs/framework/types'
import { Modules } from '@medusajs/framework/utils'
import { medusaIntegrationTestRunner } from '@medusajs/test-utils'
import { createStore } from '../helpers/admin'
import { login, send, TEST_PASSWORD } from '../helpers/customer'
import { linkParam, waitForNotifications } from '../helpers/notifications'

jest.setTimeout(240 * 1000)

const PERSON = { first_name: 'Jan', last_name: 'Kowalski', phone: '+48600100200' }

// medusa-config.ts: emailThrottle { max: 2 } for the account e-mails.
const THROTTLE = 2

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe('account registration and e-mail confirmation', () => {
      let container: MedusaContainer
      let headers: Record<string, string>

      const register = (email: string) =>
        send(
          api.post(
            '/store/account/register',
            { email, password: TEST_PASSWORD, ...PERSON },
            { headers },
          ),
        )

      beforeEach(async () => {
        container = getContainer()
        headers = { 'x-publishable-api-key': (await createStore(container)).publishableKey }
      })

      it('registers with an e-mail in capitals and spaces and normalizes it', async () => {
        const response = await register('  Jan.Kowalski@Example.PL ')
        expect(response.status).toBe(201)
        expect(response.data.customer.email).toBe('jan.kowalski@example.pl')

        const token = await login(api, 'jan.kowalski@example.pl')
        expect(typeof token).toBe('string')

        const customers = await container
          .resolve(Modules.CUSTOMER)
          .listCustomers({ email: 'jan.kowalski@example.pl', has_account: true })
        expect(customers).toHaveLength(1)
        expect(customers[0]).toMatchObject({ ...PERSON, has_account: true })

        const [notification] = await waitForNotifications(
          container,
          'jan.kowalski@example.pl',
          'email-confirmation',
        )
        expect(notification?.status).toBe('success')
        expect((notification?.data as { actionUrl?: string } | undefined)?.actionUrl).toContain(
          'https://shop.test/confirm-email?kod=',
        )
        expect(await isEmailConfirmed(container, customers[0]?.id as string)).toBe(false)
      })

      it('a second registration with the same address is 422 with one identity', async () => {
        expect((await register('anna@example.com')).status).toBe(201)
        const again = await register(' Anna@Example.com')
        expect(again.status).toBe(422)
        expect(again.data.type).toBe('duplicate_error')
        expect(again.data.message).toBe('Konto z tym adresem już istnieje.')

        const identities = await container
          .resolve(Modules.AUTH)
          .listProviderIdentities({ provider: 'emailpass', entity_id: 'anna@example.com' })
        expect(identities).toHaveLength(1)
      })

      it('the code confirms the e-mail once; resending after the confirmation does nothing', async () => {
        await register('ola@example.com')
        const [notification] = await waitForNotifications(
          container,
          'ola@example.com',
          'email-confirmation',
        )
        const code = linkParam(notification, 'kod')
        const token = await login(api, 'ola@example.com')
        const auth = { headers: { ...headers, authorization: `Bearer ${token}` } }

        // The link alone (a mail scanner, someone without the account) confirms nothing.
        expect(
          (await send(api.post('/store/account/confirm-email', { code }, { headers }))).status,
        ).toBe(401)

        const confirmed = await send(api.post('/store/account/confirm-email', { code }, auth))
        expect(confirmed.status).toBe(200)
        expect(confirmed.data).toEqual({ linked: 0 })

        const again = await send(api.post('/store/account/confirm-email', { code }, auth))
        expect(again.status).toBe(400)
        expect(again.data).toEqual({
          type: 'invalid_data',
          message: 'Link wygasł albo został już użyty.',
        })

        const [customer] = await container
          .resolve(Modules.CUSTOMER)
          .listCustomers({ email: 'ola@example.com', has_account: true })
        expect(await isEmailConfirmed(container, customer?.id as string)).toBe(true)

        const resend = await send(api.post('/store/account/email-confirmation', {}, auth))
        expect(resend.status).toBe(200)
        expect(resend.data).toEqual({ sent: false, confirmed: true })
      })

      it('resending before the confirmation sends a new link and the old one stops working', async () => {
        await register('ewa@example.com')
        const [first] = await waitForNotifications(
          container,
          'ewa@example.com',
          'email-confirmation',
        )
        const token = await login(api, 'ewa@example.com')
        const auth = { headers: { ...headers, authorization: `Bearer ${token}` } }
        const resend = await send(api.post('/store/account/email-confirmation', {}, auth))
        expect(resend.status).toBe(201)
        expect(resend.data).toEqual({ sent: true })

        const rows = await waitForNotifications(
          container,
          'ewa@example.com',
          'email-confirmation',
          2,
        )
        expect(rows).toHaveLength(2)
        const old = await send(
          api.post('/store/account/confirm-email', { code: linkParam(first, 'kod') }, auth),
        )
        expect(old.status).toBe(400)
      })

      it("another account's code does not confirm the signed-in customer", async () => {
        await register('owner@example.com')
        await register('stranger@example.com')
        const [mail] = await waitForNotifications(
          container,
          'owner@example.com',
          'email-confirmation',
        )
        const stranger = await login(api, 'stranger@example.com')
        const response = await send(
          api.post(
            '/store/account/confirm-email',
            { code: linkParam(mail, 'kod') },
            { headers: { ...headers, authorization: `Bearer ${stranger}` } },
          ),
        )
        expect(response.status).toBe(400)
        const [owner] = await container
          .resolve(Modules.CUSTOMER)
          .listCustomers({ email: 'owner@example.com', has_account: true })
        expect(await isEmailConfirmed(container, owner?.id as string)).toBe(false)
      })

      it('throttles the e-mail confirmation after the configured number of mails: 429', async () => {
        await register('limit@example.com')
        const token = await login(api, 'limit@example.com')
        const auth = { headers: { ...headers, authorization: `Bearer ${token}` } }
        await waitForNotifications(container, 'limit@example.com', 'email-confirmation')
        // The registration mail is the first; one more fits in the window of THROTTLE = 2.
        for (let sent = 1; sent < THROTTLE; sent++) {
          expect((await send(api.post('/store/account/email-confirmation', {}, auth))).status).toBe(
            201,
          )
          await waitForNotifications(container, 'limit@example.com', 'email-confirmation', sent + 1)
        }
        const refused = await send(api.post('/store/account/email-confirmation', {}, auth))
        expect(refused.status).toBe(429)
        expect(refused.data).toEqual({
          type: 'too_many_requests',
          message: 'Za dużo prób. Spróbuj ponownie za kilka minut.',
        })
      })

      it('a failed customer creation removes the identity (compensation)', async () => {
        await container
          .resolve(Modules.CUSTOMER)
          .createCustomers({ email: 'k@example.com', has_account: true })

        expect((await register('k@example.com')).status).toBe(422)
        const identities = await container
          .resolve(Modules.AUTH)
          .listProviderIdentities({ provider: 'emailpass', entity_id: 'k@example.com' })
        expect(identities).toHaveLength(0)
      })

      it('validation: a short password and an empty first name are 400', async () => {
        const response = await send(
          api.post(
            '/store/account/register',
            {
              email: 'x@example.com',
              password: 'short',
              first_name: '',
              last_name: 'X',
              phone: '1',
            },
            { headers },
          ),
        )
        expect(response.status).toBe(400)
      })

      it('Medusa’s own customer registration stays closed', async () => {
        const native = await send(
          api.post('/auth/customer/emailpass/register', {
            email: 'native@example.com',
            password: TEST_PASSWORD,
          }),
        )
        expect(native.status).toBe(404)
        expect(native.data).toEqual({ type: 'not_found', message: 'Nie znaleziono.' })
      })
    })
  },
})

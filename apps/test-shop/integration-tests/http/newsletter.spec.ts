import { medusaIntegrationTestRunner } from '@medusajs/test-utils'
import { createAdminHeaders, createStore } from '../helpers/admin'

jest.setTimeout(120 * 1000)

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe('newsletter sign-ups', () => {
      let publishableKey: string
      let admin: Record<string, string>
      let shop: Record<string, string>

      const signUp = (email: string, headers = shop) =>
        api
          .post(
            '/store/newsletter-subscribers',
            {
              email,
              consent_text: 'Chcę dostawać newsletter, "porady"',
              consent_at: '2026-11-01T10:00:00.000Z',
              source: 'footer',
            },
            { headers },
          )
          .catch((error) => error.response)

      beforeEach(async () => {
        const container = getContainer()
        ;({ publishableKey } = await createStore(container))
        admin = await createAdminHeaders(container)
        shop = {
          'x-publishable-api-key': publishableKey,
          'x-storefront-secret': process.env.STOREFRONT_API_SECRET ?? '',
        }
      })

      it('accepts sign-ups only from the shop server, once per address', async () => {
        const stranger = await signUp('ola@example.pl', {
          'x-publishable-api-key': publishableKey,
        })
        expect(stranger.status).toBe(401)
        expect(stranger.data).toEqual({
          code: 'newsletter_storefront_secret_invalid',
          message: 'Brak dostępu.',
        })

        expect((await signUp(' Ola@Example.pl ')).status).toBe(201)
        const again = await signUp('ola@example.pl')
        expect(again.status).toBe(422)
        expect(again.data.message).toBe('Ten adres jest już zapisany.')
        expect(again.data.code).toBe('newsletter_already_subscribed')
        const exists = await api.get('/store/newsletter-subscribers?email=ola@example.pl', {
          headers: shop,
        })
        expect(exists.data).toEqual({ exists: true })
      })

      it('rejects every sign-up when the secret env is empty', async () => {
        const secret = process.env.STOREFRONT_API_SECRET
        delete process.env.STOREFRONT_API_SECRET
        try {
          const withHeader = await signUp('ola@example.pl')
          expect(withHeader.status).toBe(401)
          expect(withHeader.data.code).toBe('newsletter_storefront_secret_invalid')
          const emptyHeader = await signUp('ola@example.pl', {
            'x-publishable-api-key': publishableKey,
            'x-storefront-secret': '',
          })
          expect(emptyHeader.status).toBe(401)
        } finally {
          process.env.STOREFRONT_API_SECRET = secret
        }
        expect(
          (await api.get('/admin/newsletter-subscribers', { headers: admin })).data.count,
        ).toBe(0)
      })

      it('lists, exports and deletes sign-ups in the panel', async () => {
        await signUp('ola@example.pl')
        await signUp('jan@example.pl')
        const list = (await api.get('/admin/newsletter-subscribers?q=ola', { headers: admin })).data
        expect(list.count).toBe(1)
        expect(list.subscribers[0]).toMatchObject({ email: 'ola@example.pl', source: 'footer' })

        const csv = await api.get('/admin/newsletter-subscribers/export', { headers: admin })
        expect(csv.headers['content-type']).toContain('text/csv')
        expect(csv.data).toContain('email,data_zgody,zrodlo,tresc_zgody\r\n')
        expect(csv.data).toContain(
          'ola@example.pl,2026-11-01T10:00:00.000Z,footer,"Chcę dostawać newsletter, ""porady"""',
        )
        const raw = await api.get('/admin/newsletter-subscribers/export', {
          headers: admin,
          responseType: 'arraybuffer',
        })
        expect([...Buffer.from(raw.data).subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])

        await api.delete(`/admin/newsletter-subscribers/${list.subscribers[0].id}`, {
          headers: admin,
        })
        expect(
          (await api.get('/admin/newsletter-subscribers', { headers: admin })).data.count,
        ).toBe(1)
      })

      it('gives the admin page the texts of the plugin options', async () => {
        const { data } = await api.get('/admin/newsletter/messages', { headers: admin })
        expect(data.locale).toBe('pl')
        // `messages.adminTitle` is set in medusa-config.ts; the rest is the Polish dictionary.
        expect(data.messages.adminTitle).toBe('Newsletter (test-shop)')
        expect(data.messages.alreadySubscribed).toBe('Ten adres jest już zapisany.')
        expect(data.messages.sourceLabels.footer).toBe('Stopka')

        const anonymous = await api.get('/admin/newsletter/messages').catch((e) => e.response)
        expect(anonymous.status).toBe(401)
      })

      it('refuses a source the model does not know', async () => {
        const response = await api
          .post(
            '/store/newsletter-subscribers',
            {
              email: 'ola@example.pl',
              consent_text: 'Zgoda',
              consent_at: '2026-11-01T10:00:00.000Z',
              source: 'popup',
            },
            { headers: shop },
          )
          .catch((error) => error.response)
        expect(response.status).toBe(400)
      })
    })
  },
})

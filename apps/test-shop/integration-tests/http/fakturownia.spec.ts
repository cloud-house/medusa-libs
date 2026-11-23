import { fakeFakturownia } from '@cloud-house/medusa-fakturownia'
import type { MedusaContainer } from '@medusajs/framework/types'
import { medusaIntegrationTestRunner } from '@medusajs/test-utils'
import { createAdminHeaders, createStore, type TestStore } from '../helpers/admin'
import { sleep } from '../helpers/customer'
import { waitForNotifications } from '../helpers/notifications'
import { placeOrder } from '../helpers/orders'

jest.setTimeout(240 * 1000)

// Read at call time by the plugin – the in-process fake instead of Fakturownia.
process.env.FAKTUROWNIA_URL = 'atrapa'

type Card = {
  invoice: {
    status: string
    number: string | null
    ready: boolean
    emailSentAt: string | null
    emailError: string | null
    lastError: string | null
  } | null
}

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe('medusa-fakturownia', () => {
      let container: MedusaContainer
      let store: TestStore
      let admin: Record<string, string>

      const card = async (orderId: string): Promise<Card> =>
        (await api.get(`/admin/orders/${orderId}/invoice`, { headers: admin })).data

      /** Until the `order.placed` subscriber has issued the invoice and mailed it. */
      async function issued(orderId: string): Promise<Card> {
        for (let i = 0; i < 100; i++) {
          const current = await card(orderId)
          if (current.invoice?.ready && current.invoice.emailSentAt) return current
          await sleep(100)
        }
        return card(orderId)
      }

      const failed = (request: Promise<unknown>) =>
        request.catch((error: { response: { status: number; data: Record<string, string> } }) => {
          return error.response
        }) as Promise<{ status: number; data: Record<string, string> }>

      beforeEach(async () => {
        // Every test starts with order #1 again – the in-process fake must forget the earlier invoices.
        fakeFakturownia().reset()
        container = getContainer()
        store = await createStore(container)
        admin = await createAdminHeaders(container)
      })

      it('issues the invoice of a placed order and shows it on the admin card', async () => {
        const { orderId } = await placeOrder(container, {
          email: 'jan@example.pl',
          regionId: store.regionId,
        })

        const { invoice } = await issued(orderId)

        expect(invoice).toMatchObject({ status: 'issued', ready: true, lastError: null })
        expect(invoice?.number).toEqual(expect.any(String))
        // The plugin's `oidPrefix` option reached the Fakturownia order number.
        expect(fakeFakturownia().invoices[0]?.payload.oid).toBe('TEST-1')
      })

      it('mails the invoice with the PDF through the e-mail provider', async () => {
        const { orderId } = await placeOrder(container, {
          email: 'maila@example.pl',
          regionId: store.regionId,
        })
        await issued(orderId)

        const [mail] = await waitForNotifications(container, 'maila@example.pl', 'invoice')

        expect(mail?.status).toBe('success')
        expect(mail?.data).toMatchObject({
          displayId: expect.any(Number),
          number: expect.any(String),
        })
      })

      it('serves the PDF of a ready invoice to the admin', async () => {
        const { orderId } = await placeOrder(container, {
          email: 'pdf@example.pl',
          regionId: store.regionId,
        })
        await issued(orderId)

        const response = await api.get(`/admin/orders/${orderId}/invoice/pdf`, {
          headers: admin,
          responseType: 'arraybuffer',
        })

        expect(response.status).toBe(200)
        expect(response.headers['content-type']).toBe('application/pdf')
        expect(response.headers['content-disposition']).toMatch(/^attachment; filename="Faktura-/)
      })

      it('refuses the admin card without a sign-in', async () => {
        const { orderId } = await placeOrder(container, {
          email: 'noauth@example.pl',
          regionId: store.regionId,
        })

        expect((await failed(api.get(`/admin/orders/${orderId}/invoice`))).status).toBe(401)
      })

      it('does not give the invoice PDF to a visitor without a customer session', async () => {
        const { orderId } = await placeOrder(container, {
          email: 'guest@example.pl',
          regionId: store.regionId,
        })
        await issued(orderId)

        const response = await failed(
          api.get(`/store/account/orders/${orderId}/invoice`, {
            headers: { 'x-publishable-api-key': store.publishableKey },
          }),
        )

        expect(response.status).toBe(401)
      })
    })
  },
})

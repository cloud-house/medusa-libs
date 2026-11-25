import {
  FURGONETKA_MODULE,
  type FurgonetkaModuleService,
  fakeFurgonetka,
  markPickedUp,
  webhookBody,
} from '@cloud-house/medusa-furgonetka'
import type { MedusaContainer } from '@medusajs/framework/types'
import { medusaIntegrationTestRunner } from '@medusajs/test-utils'
import { createAdminHeaders, createStore, type TestStore } from '../helpers/admin'
import type { TestResponse } from '../helpers/customer'
import { waitForNotifications } from '../helpers/notifications'
import { placeOrder } from '../helpers/orders'
import { setupOutbound } from '../helpers/outbound'
import { createTestProduct } from '../helpers/products'

jest.setTimeout(300 * 1000)

// Read at call time by the plugin – the in-process fake instead of Furgonetka.
process.env.FURGONETKA_URL = 'atrapa'

const send = (promise: Promise<TestResponse>) => promise.catch((error) => error.response)
const DROP_OFF = { type: 'drop_off' }

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe('medusa-furgonetka', () => {
      let container: MedusaContainer
      let store: TestStore
      let admin: { headers: Record<string, string> }
      let sofa: string
      let lamp: string
      let shippingOptionId: string

      const furgonetka = () => container.resolve<FurgonetkaModuleService>(FURGONETKA_MODULE)
      const template = (name: string, purpose: string | null, kind = 'box') => ({
        name,
        kind,
        length_cm: 60,
        width_cm: 40,
        height_cm: 30,
        weight_g: 5000,
        purpose,
      })

      beforeEach(async () => {
        process.env.FURGONETKA_URL = 'atrapa'
        fakeFurgonetka().reset()
        container = getContainer()
        store = await createStore(container)
        admin = { headers: await createAdminHeaders(container) }
        shippingOptionId = (await setupOutbound(container, store.regionId)).shippingOptionId
        sofa = (
          await createTestProduct(container, store.salesChannelId, {
            handle: 'sofa-1',
            metadata: { parcel_class: 'sofa' },
          })
        ).id
        lamp = (
          await createTestProduct(container, store.salesChannelId, {
            handle: 'lamp-1',
            metadata: { parcel_class: 'lamp' },
          })
        ).id
        for (const body of [
          template('Karton sofa', 'sofa'),
          template('Karton lampa', 'lamp'),
          template('Karton mały', 'accessories_courier'),
          template('Paczkomat A', 'accessories_locker', 'locker_a'),
        ]) {
          await api.post('/admin/parcel-templates', body, admin)
        }
        await api.post('/admin/furgonetka/connect', {}, admin)
      })

      const order = (
        lines: { title: string; quantity: number; product_id?: string }[],
        metadata: Record<string, unknown> = {},
        email = 'jan@example.pl',
      ) =>
        placeOrder(container, {
          email,
          regionId: store.regionId,
          metadata,
          shippingOptionId,
          items: lines.map((line) => ({ unit_price: 1000, ...line })),
        }).then((placed) => placed.orderId)
      const rows = async () => (await api.get('/admin/shipping/queue', admin)).data.rows
      const rowOf = async (orderId: string) =>
        (await rows()).find((row: { orderId: string }) => row.orderId === orderId)

      it('shows the connection with the shop parcel classes, and nothing is configured without FURGONETKA_URL', async () => {
        const connected = (await api.get('/admin/furgonetka', admin)).data
        expect(connected).toMatchObject({
          state: 'connected',
          parcelClasses: [
            { key: 'sofa', label: 'Sofa' },
            { key: 'lamp', label: 'Lampa' },
          ],
        })

        delete process.env.FURGONETKA_URL
        const off = (await api.get('/admin/furgonetka', admin)).data
        expect(off.state).toBe('not_configured')
        expect((await api.get('/admin/shipping/queue', admin)).data.configured).toBe(false)
      })

      it('takes a parcel class as the purpose of a template and refuses an unknown one', async () => {
        const created = await api.post(
          '/admin/parcel-templates',
          template('Karton duży', null),
          admin,
        )
        expect(created.status).toBe(200)

        const moved = await api.post(
          `/admin/parcel-templates/${created.data.template.id}`,
          template('Karton duży', 'sofa'),
          admin,
        )
        expect(moved.data.template.purpose).toBe('sofa')
        const all = (await api.get('/admin/parcel-templates', admin)).data.templates
        expect(all.filter((t: { purpose: string | null }) => t.purpose === 'sofa')).toHaveLength(1)

        const refused = await send(
          api.post('/admin/parcel-templates', template('Karton X', 'bogus'), admin),
        )
        expect(refused.status).toBe(400)
      })

      it('plans every piece of every class in its own carton and the rest in one small carton', async () => {
        const orderId = await order([
          { title: 'Sofa', quantity: 2, product_id: sofa },
          { title: 'Lampa', quantity: 1, product_id: lamp },
          { title: 'Poduszka', quantity: 3 },
        ])

        const row = await rowOf(orderId)

        expect(row.parcels.map((parcel: { name: string }) => parcel.name)).toEqual([
          'Karton sofa',
          'Karton sofa',
          'Karton lampa',
          'Karton mały',
        ])
        expect(row.problems).toEqual([])
        expect(row.selectable).toBe(true)
      })

      it('a class that lists only DPD blocks the InPost courier, a class that lists it does not', async () => {
        const blocked = await order([{ title: 'Sofa', quantity: 1, product_id: sofa }], {
          delivery_code: 'kurier-inpost',
        })
        const allowed = await order(
          [{ title: 'Lampa', quantity: 1, product_id: lamp }],
          { delivery_code: 'kurier-inpost' },
          'ola@example.pl',
        )

        const blockedRow = await rowOf(blocked)
        const allowedRow = await rowOf(allowed)

        expect(blockedRow.selectable).toBe(false)
        expect(blockedRow.problems[0]).toContain('DPD')
        expect(allowedRow.selectable).toBe(true)
      })

      it('a product whose class nobody declared is an ordinary item', async () => {
        const typo = (
          await createTestProduct(container, store.salesChannelId, {
            handle: 'typo-1',
            metadata: { parcel_class: 'sofaa' },
          })
        ).id
        const orderId = await order([{ title: 'Coś', quantity: 1, product_id: typo }])

        const row = await rowOf(orderId)

        expect(row.parcels.map((parcel: { name: string }) => parcel.name)).toEqual(['Karton mały'])
        expect(row.problems).toEqual([])
      })

      it('creates the shipment with a label; two simultaneous creates make one shipment', async () => {
        const orderId = await order([{ title: 'Sofa', quantity: 1, product_id: sofa }])

        const results = await Promise.all([
          send(
            api.post(
              '/admin/shipping/shipments',
              { order_ids: [orderId], pickup: DROP_OFF },
              admin,
            ),
          ),
          send(
            api.post(
              '/admin/shipping/shipments',
              { order_ids: [orderId], pickup: DROP_OFF },
              admin,
            ),
          ),
        ])

        const oks = results.flatMap((response) => response.data?.results ?? []).filter((r) => r.ok)
        expect(oks).toHaveLength(1)
        const shipments = await furgonetka().listShipments({ order_id: orderId })
        expect(shipments).toHaveLength(1)
        expect(shipments[0]?.state).toBe('ready')

        const label = await api.get(`/admin/shipments/${shipments[0]?.id}/label`, {
          ...admin,
          responseType: 'arraybuffer',
        })
        expect(label.status).toBe(200)
        expect(String(label.headers['content-type'])).toContain('application/pdf')
      })

      it('the webhook: a bad signature is refused, a good one moves the shipment and mails the customer once', async () => {
        const orderId = await order([{ title: 'Sofa', quantity: 1, product_id: sofa }])
        await api.post(
          '/admin/shipping/shipments',
          { order_ids: [orderId], pickup: DROP_OFF },
          admin,
        )
        const [shipment] = await furgonetka().listShipments({ order_id: orderId })
        const packageId = shipment?.package_id as string
        markPickedUp(packageId)
        const body = webhookBody(packageId, 'collected')

        const bad = await send(api.post('/hooks/furgonetka', { ...body, control: 'wrong' }))
        const good = await send(api.post('/hooks/furgonetka', body))
        const again = await send(api.post('/hooks/furgonetka', body))

        expect(bad.status).not.toBe(200)
        expect(good.status).toBe(200)
        expect(again.status).toBe(200)
        expect((await furgonetka().retrieveShipment(shipment?.id as string)).state).toBe(
          'in_transit',
        )
        const mails = await waitForNotifications(container, 'jan@example.pl', 'shipment')
        expect(mails).toHaveLength(1)
        expect(mails[0]?.status).toBe('success')
      })
    })
  },
})

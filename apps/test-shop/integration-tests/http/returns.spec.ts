import { RETURN_MESSAGES, returnExpiredMessage } from '@cloud-house/commerce-rules'
import { ensureReturnReasons } from '@cloud-house/medusa-returns'
import type { MedusaContainer } from '@medusajs/framework/types'
import { Modules } from '@medusajs/framework/utils'
import { medusaIntegrationTestRunner } from '@medusajs/test-utils'
import { createStore, type TestStore } from '../helpers/admin'
import { type Api, registerCustomer, send } from '../helpers/customer'
import { notificationsAfterPause, waitForNotifications } from '../helpers/notifications'
import { orderCustomer, placeOrder } from '../helpers/orders'
import { setupReturnShipping, shipOrder } from '../helpers/returns'

jest.setTimeout(240 * 1000)

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe('medusa-returns', () => {
      let container: MedusaContainer
      let store: TestStore
      let headers: Record<string, string>

      beforeEach(async () => {
        container = getContainer()
        store = await createStore(container)
        headers = { 'x-publishable-api-key': store.publishableKey }
        await setupReturnShipping(container, store.regionId)
      })

      const orderLineId = async (orderId: string) => {
        const [order] = await container
          .resolve(Modules.ORDER)
          .listOrders({ id: orderId }, { relations: ['items'] })
        return order.items?.[0]?.id as string
      }

      it('lookup: a guest sees what can be returned, a wrong e-mail gets the same 404 as a wrong number', async () => {
        const { orderId } = await placeOrder(container, {
          email: 'jan@example.pl',
          regionId: store.regionId,
        })
        await shipOrder(container, orderId)
        const [order] = await container.resolve(Modules.ORDER).listOrders({ id: orderId })

        const found = await api.post(
          '/store/returns/lookup',
          { display_id: order.display_id, email: ' Jan@Example.pl ' },
          { headers },
        )
        expect(found.status).toBe(200)
        expect(found.data.returns.eligible).toBe(true)
        expect(found.data.returns.items).toHaveLength(1)
        expect(found.data.returns.window.days).toBe(14)

        const wrongEmail = await send(
          api.post(
            '/store/returns/lookup',
            { display_id: order.display_id, email: 'other@example.pl' },
            { headers },
          ),
        )
        const wrongNumber = await send(
          api.post(
            '/store/returns/lookup',
            { display_id: 99999, email: 'jan@example.pl' },
            { headers },
          ),
        )
        expect(wrongEmail.status).toBe(404)
        expect(wrongNumber.status).toBe(404)
        expect(wrongEmail.data).toEqual(wrongNumber.data)
        expect(wrongEmail.data.message).toBe(RETURN_MESSAGES.guestNotFound)
      })

      it('claim: a guest return is created, a second claim for the same piece is refused', async () => {
        const { orderId } = await placeOrder(container, {
          email: 'jan@example.pl',
          regionId: store.regionId,
        })
        await shipOrder(container, orderId)
        const [order] = await container.resolve(Modules.ORDER).listOrders({ id: orderId })
        const line = await orderLineId(orderId)
        const body = {
          display_id: order.display_id,
          email: 'jan@example.pl',
          items: [{ id: line, quantity: 1, reason: 'size' }],
          note: 'Za mała',
        }

        const created = await api.post('/store/returns/claim', body, { headers })
        expect(created.status).toBe(200)
        expect(created.data.return.status).toBe('requested')
        expect(created.data.return.items[0]).toMatchObject({ quantity: 1, reason: 'size' })

        const again = await send(api.post('/store/returns/claim', body, { headers }))
        expect(again.status).toBe(400)
        expect(again.data.message).toBe(RETURN_MESSAGES.nothingLeft)
      })

      it('claim: two simultaneous claims for the same piece give one return', async () => {
        const { orderId } = await placeOrder(container, {
          email: 'jan@example.pl',
          regionId: store.regionId,
        })
        await shipOrder(container, orderId)
        const [order] = await container.resolve(Modules.ORDER).listOrders({ id: orderId })
        const line = await orderLineId(orderId)
        const body = {
          display_id: order.display_id,
          email: 'jan@example.pl',
          items: [{ id: line, quantity: 1, reason: 'defect' }],
        }

        const results = await Promise.all([
          send(api.post('/store/returns/claim', body, { headers })),
          send(api.post('/store/returns/claim', body, { headers })),
        ])

        expect(results.map((result) => result.status).sort()).toEqual([200, 400])
        const returns = await container.resolve(Modules.ORDER).listReturns({ order_id: orderId })
        expect(returns).toHaveLength(1)
      })

      it('claim: outside the window the answer names the length of the window', async () => {
        const { orderId } = await placeOrder(container, {
          email: 'jan@example.pl',
          regionId: store.regionId,
        })
        await shipOrder(container, orderId, { deliveredDaysAgo: 40 })
        const [order] = await container.resolve(Modules.ORDER).listOrders({ id: orderId })
        const line = await orderLineId(orderId)

        const refused = await send(
          api.post(
            '/store/returns/claim',
            {
              display_id: order.display_id,
              email: 'jan@example.pl',
              items: [{ id: line, quantity: 1, reason: 'size' }],
            },
            { headers },
          ),
        )

        expect(refused.status).toBe(400)
        expect(refused.data.message).toBe(returnExpiredMessage(14))
      })

      it('an order that was not shipped cannot be returned', async () => {
        const { orderId } = await placeOrder(container, {
          email: 'jan@example.pl',
          regionId: store.regionId,
        })
        const [order] = await container.resolve(Modules.ORDER).listOrders({ id: orderId })
        const line = await orderLineId(orderId)

        const refused = await send(
          api.post(
            '/store/returns/claim',
            {
              display_id: order.display_id,
              email: 'jan@example.pl',
              items: [{ id: line, quantity: 1, reason: 'size' }],
            },
            { headers },
          ),
        )

        expect(refused.status).toBe(400)
        expect(refused.data.message).toBe(RETURN_MESSAGES.notShipped)
      })

      it("account: a customer returns their own order, another customer's order is a 404", async () => {
        const mine = await registerCustomer(api as Api, headers, { email: 'ala@example.pl' })
        const other = await registerCustomer(api as Api, headers, { email: 'ola@example.pl' })
        const { orderId } = await placeOrder(container, {
          email: 'ala@example.pl',
          regionId: store.regionId,
          customerId: mine.customerId,
          cartMetadata: { account_customer_id: mine.customerId },
        })
        // The `order.placed` subscribers of the accounts plugin settle first.
        const owner = await orderCustomer(container, orderId, (c) => c?.id === mine.customerId)
        expect(owner?.id).toBe(mine.customerId)
        await shipOrder(container, orderId)
        const line = await orderLineId(orderId)
        const body = { items: [{ id: line, quantity: 1, reason: 'mind_changed' }] }

        const foreign = await send(
          api.post(`/store/account/orders/${orderId}/return`, body, {
            headers: other.authHeaders,
          }),
        )
        expect(foreign.status).toBe(404)

        const created = await send(
          api.post(`/store/account/orders/${orderId}/return`, body, {
            headers: mine.authHeaders,
          }),
        )
        expect(created.status).toBe(200)
        expect(created.data.return.status).toBe('requested')
      })

      it('the customer and the shop get one e-mail each, and a repeated event sends nothing more', async () => {
        const { orderId } = await placeOrder(container, {
          email: 'jan@example.pl',
          regionId: store.regionId,
        })
        await shipOrder(container, orderId)
        const [order] = await container.resolve(Modules.ORDER).listOrders({ id: orderId })
        const line = await orderLineId(orderId)

        const created = await api.post(
          '/store/returns/claim',
          {
            display_id: order.display_id,
            email: 'jan@example.pl',
            items: [{ id: line, quantity: 1, reason: 'size' }],
          },
          { headers },
        )

        const [mail] = await waitForNotifications(container, 'jan@example.pl', 'return-requested')
        const [alert] = await waitForNotifications(container, 'contact@shop.test', 'return-alert')
        expect(mail?.status).toBe('success')
        expect(mail?.data).toMatchObject({
          displayId: order.display_id,
          labelUrl: `http://localhost:3200/returns/label?order=${order.display_id}`,
        })
        expect(alert?.status).toBe('success')

        await container.resolve(Modules.EVENT_BUS).emit({
          name: 'order.return_requested',
          data: { order_id: orderId, return_id: created.data.return.id },
        })
        expect(
          await notificationsAfterPause(container, 'jan@example.pl', 'return-requested'),
        ).toHaveLength(1)
        expect(
          await notificationsAfterPause(container, 'contact@shop.test', 'return-alert'),
        ).toHaveLength(1)
      })

      it('ensureReturnReasons creates nothing the second time', async () => {
        expect(await ensureReturnReasons(container)).toBe(0)
      })

      it("Medusa's own return route stays closed", async () => {
        const closed = await send(api.post('/store/returns', {}, { headers }))
        expect([404, 405]).toContain(closed.status)
      })
    })
  },
})

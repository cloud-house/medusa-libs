import type { MedusaContainer } from '@medusajs/framework/types'
import { Modules, type ProductStatus } from '@medusajs/framework/utils'
import { createSalesChannelsWorkflow } from '@medusajs/medusa/core-flows'
import { medusaIntegrationTestRunner } from '@medusajs/test-utils'
import {
  createCustomerHeaders,
  createStore,
  type TestCustomer,
  type TestStore,
} from '../helpers/admin'
import { createTestProduct } from '../helpers/products'

jest.setTimeout(120 * 1000)

// medusa-config.ts sets `limit: 3` for the favorites plugin.
const LIMIT = 3

type Reply = { status: number; data: Record<string, unknown> & { product_ids: string[] } }

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe('favorites', () => {
      let container: MedusaContainer
      let store: TestStore
      let customer: TestCustomer

      const send = (request: Promise<unknown>) =>
        request.catch((error: { response: Reply }) => error.response) as Promise<Reply>
      const product = async (handle: string, input: { status?: ProductStatus } = {}) =>
        (await createTestProduct(container, store.salesChannelId, { handle, ...input })).id
      const products = (count: number) =>
        Promise.all(Array.from({ length: count }, (_, i) => product(`fav-${i}`)))
      const list = () => api.get('/store/account/favorites', { headers: customer.authHeaders })
      const add = (product_id: string) =>
        send(
          api.post('/store/account/favorites', { product_id }, { headers: customer.authHeaders }),
        )
      const remove = (product_id: string) =>
        api.delete(`/store/account/favorites/${product_id}`, { headers: customer.authHeaders })
      const merge = (items: { product_id: string; added_at: string }[]) =>
        api.post('/store/account/favorites/merge', { items }, { headers: customer.authHeaders })

      beforeEach(async () => {
        container = getContainer()
        store = await createStore(container)
        customer = await createCustomerHeaders(container, store.publishableKey)
      })

      it('adds once, lists newest first, removes', async () => {
        const [a, b] = await products(2)
        expect((await add(a as string)).data).toEqual({ product_ids: [a] })
        expect((await add(a as string)).data).toEqual({ product_ids: [a] })
        expect((await add(b as string)).data).toEqual({ product_ids: [b, a] })
        expect((await list()).data).toEqual({ product_ids: [b, a] })

        expect((await remove(a as string)).data).toEqual({ product_ids: [b] })
        expect((await remove(a as string)).data).toEqual({ product_ids: [b] })
      })

      it('unknown product: 404 with the Polish text and the code product_not_found', async () => {
        const refused = await add('prod_missing')
        expect(refused.status).toBe(404)
        expect(refused.data).toEqual({
          type: 'not_found',
          code: 'product_not_found',
          message: 'Nie znaleziono produktu.',
        })
      })

      it('a draft disappears from the list and comes back when published', async () => {
        const [a, b] = await products(2)
        await add(a as string)
        await add(b as string)
        const productModule = container.resolve(Modules.PRODUCT)
        await productModule.updateProducts(b as string, { status: 'draft' })
        expect((await list()).data).toEqual({ product_ids: [a] })
        expect((await add(b as string)).status).toBe(404)

        await productModule.updateProducts(b as string, { status: 'published' })
        expect((await list()).data).toEqual({ product_ids: [b, a] })
      })

      it('a deleted product disappears; a product outside the sales channel is a 404', async () => {
        const [a, b] = await products(2)
        await add(a as string)
        await add(b as string)
        await container.resolve(Modules.PRODUCT).softDeleteProducts([b as string])
        expect((await list()).data).toEqual({ product_ids: [a] })

        const {
          result: [channel],
        } = await createSalesChannelsWorkflow(container).run({
          input: { salesChannelsData: [{ name: 'Other channel' }] },
        })
        const outside = await createTestProduct(container, channel?.id as string, {
          handle: 'outside',
        })
        expect((await add(outside.id)).status).toBe(404)
      })

      it('another customer sees and changes nothing of the list', async () => {
        const [a] = await products(1)
        await add(a as string)
        const other = await createCustomerHeaders(container, store.publishableKey)
        expect(
          (await api.get('/store/account/favorites', { headers: other.authHeaders })).data,
        ).toEqual({ product_ids: [] })
        await api.delete(`/store/account/favorites/${a}`, { headers: other.authHeaders })
        expect((await list()).data).toEqual({ product_ids: [a] })
      })

      it('the limit option: the next product is refused with the limit text and code', async () => {
        const created = await products(LIMIT + 1)
        for (const id of created.slice(0, LIMIT)) await add(id)

        const refused = await add(created[LIMIT] as string)
        expect(refused.status).toBe(400)
        expect(refused.data).toEqual({
          type: 'invalid_data',
          code: 'favorites_limit_reached',
          message: `Masz już ${LIMIT} ulubionych – usuń któryś, żeby dodać nowy.`,
        })
      })

      it('the limit counts only visible products', async () => {
        const created = await products(LIMIT + 1)
        await merge(
          created
            .slice(0, LIMIT)
            .map((product_id) => ({ product_id, added_at: new Date().toISOString() })),
        )
        await container
          .resolve(Modules.PRODUCT)
          .updateProducts(created[0] as string, { status: 'draft' })

        const added = await add(created[LIMIT] as string)
        expect(added.status).toBe(200)
        expect(added.data.product_ids).toHaveLength(LIMIT)
        expect(added.data.product_ids[0]).toBe(created[LIMIT])
      })

      it('merge: union, newer date wins, future dates become now, invisible ones are dropped', async () => {
        const [a, b] = await products(2)
        await add(a as string)
        const merged = await merge([
          { product_id: a as string, added_at: new Date(Date.now() + 1000).toISOString() },
          { product_id: b as string, added_at: '2099-01-01T00:00:00.000Z' },
          { product_id: 'prod_missing', added_at: new Date().toISOString() },
        ])
        expect(merged.data.trimmed).toBe(false)
        expect([...merged.data.product_ids].sort()).toEqual([a, b].sort())
      })

      it('merge over the limit keeps the newest and says trimmed, not a 500', async () => {
        const created = await products(LIMIT + 2)
        const merged = await merge(
          created.map((product_id, i) => ({
            product_id,
            added_at: new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString(),
          })),
        )
        expect(merged.status).toBe(200)
        expect(merged.data.product_ids).toHaveLength(LIMIT)
        expect(merged.data.product_ids[0]).toBe(created[created.length - 1])
        expect(merged.data.trimmed).toBe(true)
      })

      it('merge refuses more than 500 items and a date that is not ISO', async () => {
        const items = Array.from({ length: 501 }, (_, i) => ({
          product_id: `p${i}`,
          added_at: new Date().toISOString(),
        }))
        expect((await send(merge(items))).status).toBe(400)
        expect((await send(merge([{ product_id: 'p', added_at: 'yesterday' }]))).status).toBe(400)
      })

      it('no token: 401; unknown field: 400', async () => {
        expect(
          (
            await send(
              api.get('/store/account/favorites', {
                headers: { 'x-publishable-api-key': store.publishableKey },
              }),
            )
          ).status,
        ).toBe(401)
        const [a] = await products(1)
        expect(
          (
            await send(
              api.post(
                '/store/account/favorites',
                { product_id: a, customer_id: 'cus_other' },
                { headers: customer.authHeaders },
              ),
            )
          ).status,
        ).toBe(400)
      })
    })
  },
})

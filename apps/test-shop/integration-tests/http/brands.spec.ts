import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys, ProductStatus } from '@medusajs/framework/utils'
import { createSalesChannelsWorkflow } from '@medusajs/medusa/core-flows'
import { medusaIntegrationTestRunner } from '@medusajs/test-utils'
import { createAdminHeaders, createStore, type TestStore } from '../helpers/admin'
import { nextEvent } from '../helpers/events'
import { createTestProduct } from '../helpers/products'

jest.setTimeout(120 * 1000)

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe('brands', () => {
      let container: MedusaContainer
      let store: TestStore
      let headers: Record<string, string>

      const createBrand = async (body: Record<string, unknown>) =>
        (await api.post('/admin/brands', body, { headers })).data.brand
      const product = (handle: string, input: { status?: ProductStatus } = {}) =>
        createTestProduct(container, store.salesChannelId, { handle, ...input })
      const failed = (request: Promise<unknown>) =>
        request.catch((error: { response: { status: number; data: Record<string, string> } }) => {
          return error.response
        }) as Promise<{ status: number; data: Record<string, string> }>

      beforeEach(async () => {
        container = getContainer()
        store = await createStore(container)
        headers = await createAdminHeaders(container)
      })

      it('creates a brand with a handle from its name', async () => {
        const response = await api.post('/admin/brands', { name: 'Aqua Marina' }, { headers })

        expect(response.status).toBe(200)
        expect(response.data.brand).toEqual(
          expect.objectContaining({
            id: expect.any(String),
            name: 'Aqua Marina',
            handle: 'aqua-marina',
          }),
        )
      })

      it('rejects a duplicate handle with 422 and the code brand_handle_taken', async () => {
        await createBrand({ name: 'Aqua Marina' })

        const response = await failed(
          api.post('/admin/brands', { name: 'Aqua  Marina' }, { headers }),
        )

        expect(response.status).toBe(422)
        expect(response.data.code).toBe('brand_handle_taken')
        expect(response.data.message).toBe('Marka o adresie „aqua-marina” już istnieje.')
      })

      it('rejects renaming a handle onto another brand with 422', async () => {
        await createBrand({ name: 'F2' })
        const gladiator = await createBrand({ name: 'Gladiator' })

        const response = await failed(
          api.post(`/admin/brands/${gladiator.id}`, { handle: 'f2' }, { headers }),
        )

        expect(response.status).toBe(422)
        expect(response.data.code).toBe('brand_handle_taken')
      })

      it('rejects an invalid handle with 400 and brand_handle_invalid', async () => {
        const response = await failed(
          api.post('/admin/brands', { name: 'F2', handle: 'F 2!' }, { headers }),
        )

        expect(response.status).toBe(400)
        expect(response.data.code).toBe('brand_handle_invalid')
        expect(response.data.message).toBe(
          'Adres marki może zawierać tylko małe litery, cyfry i pojedyncze myślniki.',
        )
      })

      it('rejects an empty or too long name with 400 and brand_name_invalid', async () => {
        const empty = await failed(api.post('/admin/brands', { name: '  ' }, { headers }))
        const long = await failed(api.post('/admin/brands', { name: 'x'.repeat(81) }, { headers }))

        expect(empty.status).toBe(400)
        expect(empty.data).toMatchObject({
          code: 'brand_name_invalid',
          message: 'Podaj nazwę marki.',
        })
        expect(long.status).toBe(400)
        expect(long.data.message).toBe('Nazwa marki ma najwyżej 80 znaków.')
      })

      it('rejects a name that yields no handle with 400 and a Polish message', async () => {
        const response = await failed(api.post('/admin/brands', { name: '!!!' }, { headers }))

        expect(response.status).toBe(400)
        expect(response.data.code).toBe('brand_handle_underivable')
        expect(response.data.message).toContain('podaj adres')
      })

      it('lists brands with product counts', async () => {
        const f2 = await createBrand({ name: 'F2' })
        await createBrand({ name: 'Aqua Marina' })
        for (const handle of ['race-a', 'race-b']) {
          const { id } = await product(handle)
          await api.post(`/admin/products/${id}/brand`, { brand_id: f2.id }, { headers })
        }

        const { data } = await api.get('/admin/brands', { headers })

        expect(data.count).toBe(2)
        expect(
          data.brands.map((b: { handle: string; product_count: number }) => [
            b.handle,
            b.product_count,
          ]),
        ).toEqual([
          ['aqua-marina', 0],
          ['f2', 2],
        ])
      })

      it('updates name and handle', async () => {
        const brand = await createBrand({ name: 'Gladiatr' })

        const { data } = await api.post(
          `/admin/brands/${brand.id}`,
          { name: 'Gladiator', handle: 'gladiator' },
          { headers },
        )
        const fetched = await api.get(`/admin/brands/${brand.id}`, { headers })

        expect(data.brand).toEqual(
          expect.objectContaining({ name: 'Gladiator', handle: 'gladiator' }),
        )
        expect(fetched.data.brand.handle).toBe('gladiator')
      })

      it('assigns, replaces and clears the brand of a product', async () => {
        const f2 = await createBrand({ name: 'F2' })
        const gladiator = await createBrand({ name: 'Gladiator' })
        const { id } = await product('glide')
        const url = `/admin/products/${id}/brand`

        expect((await api.get(url, { headers })).data.brand).toBeNull()
        await api.post(url, { brand_id: f2.id }, { headers })
        expect((await api.get(url, { headers })).data.brand.handle).toBe('f2')
        const replaced = await api.post(url, { brand_id: gladiator.id }, { headers })
        expect(replaced.data.brand.handle).toBe('gladiator')
        expect((await api.get(url, { headers })).data.brand.handle).toBe('gladiator')
        await api.post(url, { brand_id: null }, { headers })
        expect((await api.get(url, { headers })).data.brand).toBeNull()
      })

      it('returns 404 for an unknown brand or product', async () => {
        const { id } = await product('lonely')

        const unknownBrand = await failed(
          api.post(`/admin/products/${id}/brand`, { brand_id: 'brand_missing' }, { headers }),
        )
        const unknownProduct = await failed(
          api.get('/admin/products/prod_missing/brand', { headers }),
        )

        expect(unknownBrand.status).toBe(404)
        expect(unknownProduct.status).toBe(404)
        expect(unknownProduct.data).toMatchObject({
          code: 'brand_product_not_found',
          message: 'Nie znaleziono produktu prod_missing.',
        })
      })

      it('deleting a brand clears it from its products', async () => {
        const brand = await createBrand({ name: 'F2' })
        const { id } = await product('race')
        await api.post(`/admin/products/${id}/brand`, { brand_id: brand.id }, { headers })

        const { data } = await api.delete(`/admin/brands/${brand.id}`, { headers })
        const after = await api.get(`/admin/products/${id}/brand`, { headers })
        const list = await api.get('/admin/brands', { headers })

        expect(data).toEqual({ id: brand.id, object: 'brand', deleted: true })
        expect(after.data.brand).toBeNull()
        expect(list.data.count).toBe(0)
      })

      it('emits brand events with handles', async () => {
        const created = nextEvent(container, 'brand.created')
        const brand = await createBrand({ name: 'Gladiatr' })
        expect(await created).toEqual({ id: brand.id, handle: 'gladiatr' })

        const updated = nextEvent(container, 'brand.updated')
        await api.post(`/admin/brands/${brand.id}`, { handle: 'gladiator' }, { headers })
        expect(await updated).toEqual({
          id: brand.id,
          handle: 'gladiator',
          previous_handle: 'gladiatr',
        })

        const renamed = nextEvent(container, 'brand.updated')
        await api.post(`/admin/brands/${brand.id}`, { name: 'Gladiator' }, { headers })
        expect(await renamed).toEqual({ id: brand.id, handle: 'gladiator' })

        const { id } = await product('cruise')
        const assigned = nextEvent(container, 'product-brand.updated')
        await api.post(`/admin/products/${id}/brand`, { brand_id: brand.id }, { headers })
        expect(await assigned).toEqual({
          product_id: id,
          brand_id: brand.id,
          previous_brand_id: null,
        })

        const deleted = nextEvent(container, 'brand.deleted')
        await api.delete(`/admin/brands/${brand.id}`, { headers })
        expect(await deleted).toEqual({ id: brand.id, handle: 'gladiator' })
      })

      it('creates the product–brand link in the table the shops already have', async () => {
        const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
        const { rows } = await pg.raw(
          "select table_name from information_schema.tables where table_schema = 'public' and table_name like '%brand%' order by 1",
        )
        expect(rows.map((row: { table_name: string }) => row.table_name)).toEqual([
          'brand',
          'product_product_brand_brand',
        ])
        const brand = await createBrand({ name: 'F2' })
        const { id } = await product('linked')
        await api.post(`/admin/products/${id}/brand`, { brand_id: brand.id }, { headers })
        const link = await pg.raw('select product_id, brand_id from product_product_brand_brand')
        expect(link.rows).toEqual([{ product_id: id, brand_id: brand.id }])
      })

      it('serves the admin texts from the plugin options', async () => {
        const { data } = await api.get('/admin/brands/messages', { headers })

        expect(data.locale).toBe('pl')
        expect(data.settings).toEqual({ detailLinks: false })
        expect(data.messages.adminTitle).toBe('Brands (test-shop)')
        expect(data.messages.addBrand).toBe('Dodaj markę')
      })

      it('requires admin auth', async () => {
        const list = await failed(api.get('/admin/brands'))
        const messages = await failed(api.get('/admin/brands/messages'))
        expect(list.status).toBe(401)
        expect(messages.status).toBe(401)
      })

      describe('GET /store/brands', () => {
        it('counts only the published products in the sales channels of the key', async () => {
          const f2 = await createBrand({ name: 'F2' })
          const aqua = await createBrand({ name: 'Aqua Marina' })
          await createBrand({ name: 'Empty' })
          const {
            result: [otherChannel],
          } = await createSalesChannelsWorkflow(container).run({
            input: { salesChannelsData: [{ name: 'Other channel' }] },
          })
          const assign = async (id: string, brandId: string) =>
            api.post(`/admin/products/${id}/brand`, { brand_id: brandId }, { headers })

          await assign((await product('f2-published')).id, f2.id)
          await assign((await product('f2-draft', { status: ProductStatus.DRAFT })).id, f2.id)
          const elsewhere = await createTestProduct(container, otherChannel.id, {
            handle: 'aqua-elsewhere',
          })
          await assign(elsewhere.id, aqua.id)
          await product('no-brand')

          const { data } = await api.get('/store/brands', {
            headers: { 'x-publishable-api-key': store.publishableKey },
          })

          expect(data).toEqual({
            brands: [
              { id: aqua.id, handle: 'aqua-marina', name: 'Aqua Marina', product_count: 0 },
              { id: expect.any(String), handle: 'empty', name: 'Empty', product_count: 0 },
              { id: f2.id, handle: 'f2', name: 'F2', product_count: 1 },
            ],
          })
        })

        it('needs a publishable key', async () => {
          expect((await failed(api.get('/store/brands'))).status).toBe(400)
        })
      })
    })
  },
})

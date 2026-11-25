import type { MedusaContainer } from '@medusajs/framework/types'
import { medusaIntegrationTestRunner } from '@medusajs/test-utils'
import { createAdminHeaders, createStore } from '../helpers/admin'
import { nextEvent } from '../helpers/events'
import { createTestProduct } from '../helpers/products'

jest.setTimeout(180 * 1000)

// Read by the plugin when the app boots.
process.env.CONTENT_PREVIEW_SECRET = 'test-preview-secret'
process.env.STOREFRONT_URL = 'https://shop.test'

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

type Failure = { status: number; data: { message?: string; code?: string } }

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe('content (medusa-content)', () => {
      let container: MedusaContainer
      let admin: Record<string, string>
      let store: Record<string, string>
      let storeId: Awaited<ReturnType<typeof createStore>>

      const failed = (request: Promise<unknown>) =>
        request.catch((error: { response: Failure }) => error.response) as Promise<Failure>
      const create = async (type: string, mode: string, data: Record<string, unknown>) =>
        (await api.post('/admin/content/entries', { type, mode, data }, { headers: admin })).data
      const global = async (key: string, mode: string, data: Record<string, unknown>) =>
        (await api.post(`/admin/content/globals/${key}`, { mode, data }, { headers: admin })).data
      const storeGet = (path: string, headers: Record<string, string> = {}) =>
        api.get(path, { headers: { ...store, ...headers } })

      beforeEach(async () => {
        container = getContainer()
        admin = await createAdminHeaders(container)
        storeId = await createStore(container)
        store = { 'x-publishable-api-key': storeId.publishableKey }
      })

      it('publishes a page and the store reads it; a draft never leaves without a preview token', async () => {
        const { entry } = await create('page', 'publish', {
          title: 'Dostawa',
          slug: 'dostawa',
          lead: 'Jak wysyłamy',
        })
        expect(entry).toMatchObject({ type: 'page', slug: 'dostawa', status: 'published' })

        const page = (await storeGet('/store/content/pages/dostawa')).data.page
        expect(page).toMatchObject({ slug: 'dostawa', title: 'Dostawa' })
        const list = (await storeGet('/store/content/pages')).data
        expect(list.slugs).toEqual(['dostawa'])

        // a working copy that differs from the published text
        await api.post(
          `/admin/content/entries/${entry.id}`,
          { mode: 'draft', data: { title: 'Dostawa (szkic)', slug: 'dostawa' } },
          { headers: admin },
        )
        expect((await storeGet('/store/content/pages/dostawa')).data.page.title).toBe('Dostawa')

        // Review Focus 7: ?draft=1 without a token is refused
        const refused = await failed(storeGet('/store/content/pages/dostawa?draft=1'))
        expect(refused.status).toBe(401)
        expect(refused.data.message).toBe('Podgląd wygasł – otwórz go ponownie z panelu.')
        const forged = await failed(
          storeGet('/store/content/pages/dostawa?draft=1', { 'x-preview-token': 'a.b' }),
        )
        expect(forged.status).toBe(401)

        const preview = (
          await api.post(
            '/admin/content/preview',
            { target: 'page', id: entry.id },
            { headers: admin },
          )
        ).data
        const url = new URL(preview.url)
        expect(url.origin + url.pathname).toBe('https://shop.test/api/preview')
        expect(url.searchParams.get('collection')).toBe('pages')
        expect(url.searchParams.get('slug')).toBe('dostawa')
        const token = url.searchParams.get('token') as string
        const draft = await storeGet('/store/content/pages/dostawa?draft=1', {
          'x-preview-token': token,
        })
        expect(draft.data.page.title).toBe('Dostawa (szkic)')
      })

      it('refuses reserved and protected addresses with the same messages as before', async () => {
        const reserved = await failed(
          api.post(
            '/admin/content/entries',
            { type: 'page', mode: 'publish', data: { title: 'K', slug: 'cart' } },
            { headers: admin },
          ),
        )
        expect(reserved.status).toBe(400)
        expect(reserved.data.message).toBe('slug: Adres „cart” zajmuje już sklep – wybierz inny.')

        const { entry } = await create('page', 'publish', { title: 'Regulamin', slug: 'terms' })
        const blocked = await failed(
          api.delete(`/admin/content/entries/${entry.id}`, { headers: admin }),
        )
        expect(blocked.status).toBe(400)
        expect(blocked.data.message).toBe(
          'Tej strony nie można usunąć – linkują do niej checkout i e-maile.',
        )
        const unpublish = await failed(
          api.post(`/admin/content/entries/${entry.id}/unpublish`, {}, { headers: admin }),
        )
        expect(unpublish.data.message).toBe(
          'Tej strony nie można wycofać z publikacji – linkują do niej checkout i e-maile.',
        )
      })

      it('keeps article categories with articles: lists, details and the delete guard', async () => {
        const category = (
          await create('article_category', 'publish', { name: 'Sprzęt', slug: 'sprzet' })
        ).entry
        const media = (
          await api.post(
            '/admin/content/media',
            (() => {
              const form = new FormData()
              form.append('files', new Blob([PNG], { type: 'image/png' }), 'pixel.png')
              form.append('alt', 'Piksel')
              return form
            })(),
            { headers: admin },
          )
        ).data.media[0]
        expect(media).toMatchObject({
          kind: 'image',
          filename: 'pixel.png',
          alt: 'Piksel',
          width: 1,
        })

        const article = (
          await create('article', 'publish', {
            title: 'Jak pompować',
            slug: 'jak-pompowac',
            category: category.id,
            lead: 'Wstęp',
            image: media.id,
          })
        ).entry

        const listed = (await storeGet('/store/content/articles')).data
        expect(listed.featured).toMatchObject({ slug: 'jak-pompowac' })
        const detail = (await storeGet('/store/content/articles/jak-pompowac')).data.article
        expect(detail).toMatchObject({ slug: 'jak-pompowac', title: 'Jak pompować' })
        expect((await storeGet('/store/content/article-categories')).data.categories).toEqual([
          expect.objectContaining({ slug: 'sprzet', name: 'Sprzęt' }),
        ])

        const blocked = await failed(
          api.delete(`/admin/content/entries/${category.id}`, { headers: admin }),
        )
        expect(blocked.status).toBe(400)
        expect(blocked.data.message).toBe(
          'Ta kategoria ma artykuły – przenieś je do innej kategorii przed usunięciem.',
        )
        // the picture is used by the article, so the media library keeps it too
        const mediaBlocked = await failed(
          api.delete(`/admin/content/media/${media.id}`, { headers: admin }),
        )
        expect(mediaBlocked.status).toBe(400)
        expect(mediaBlocked.data.message).toContain('Plik jest używany')

        await api.delete(`/admin/content/entries/${article.id}`, { headers: admin })
        await expect(
          api.delete(`/admin/content/entries/${category.id}`, { headers: admin }),
        ).resolves.toMatchObject({ status: 200 })
      })

      it('stores globals and composes the layout and the home page from them', async () => {
        const defaults = (await storeGet('/store/content/layout')).data.layout
        expect(defaults.navigation).toEqual([])
        expect((await storeGet('/store/content/home')).data.home).toBeNull()
        const empty = await api.get('/admin/content/globals/header', { headers: admin })
        expect(empty.data.entry).toBeNull()

        await global('header', 'publish', { navigation: [{ label: 'Sklep', href: '/sklep' }] })
        await global('store-settings', 'publish', {
          shippingCutoff: '13:00',
          returnDays: 30,
          warrantyYears: 2,
        })
        const layout = (await storeGet('/store/content/layout')).data.layout
        expect(layout.navigation).toEqual([{ label: 'Sklep', href: '/sklep' }])
        expect(layout.settings).toMatchObject({ shippingCutoff: '13:00', returnDays: 30 })

        const media = (
          await api.post(
            '/admin/content/media',
            (() => {
              const form = new FormData()
              form.append('files', new Blob([PNG], { type: 'image/png' }), 'hero.png')
              return form
            })(),
            { headers: admin },
          )
        ).data.media[0]
        await global('home-page', 'publish', {
          layout: [
            {
              id: 'h1',
              blockType: 'hero',
              title: 'Witaj',
              image: media.id,
              cta: { label: 'Zobacz', href: '/sklep' },
            },
            { id: 'a1', blockType: 'articles', heading: 'Blog' },
          ],
        })
        const home = (await storeGet('/store/content/home')).data.home
        expect(home.blocks.map((block: { type: string }) => block.type)).toEqual([
          'hero',
          'articles',
        ])

        // Review Focus 5: unknown global key
        const unknown = await failed(api.get('/admin/content/globals/nope', { headers: admin }))
        expect(unknown.status).toBe(404)
        expect(unknown.data.message).toBe('Nieznany element układu: nope.')
      })

      it('runs a kind of the shop through the same routes (faq)', async () => {
        const { entry } = await create('faq', 'publish', { question: 'Jak zwrócić?' })
        expect(entry).toMatchObject({ type: 'faq', slug: null })
        const listed = (await api.get('/admin/content/entries?type=faq', { headers: admin })).data
          .entries
        expect(listed).toEqual([expect.objectContaining({ id: entry.id, type: 'faq' })])

        const invalid = await failed(
          api.post(
            '/admin/content/entries',
            { type: 'faq', mode: 'publish', data: { question: '' } },
            { headers: admin },
          ),
        )
        expect(invalid.status).toBe(400)
        expect(invalid.data.message).toBe('question: Podaj pytanie.')

        // Review Focus 5: unknown type
        const nope = await failed(
          api.post(
            '/admin/content/entries',
            { type: 'nope', mode: 'publish', data: {} },
            { headers: admin },
          ),
        )
        expect(nope.status).toBe(400)
        expect(nope.data.message).toBe('Nieznany typ treści: nope.')
        const list = await failed(api.get('/admin/content/entries?type=nope', { headers: admin }))
        expect(list.status).toBe(400)
        expect(list.data.message).toBe('Podaj typ: page, article, article_category albo faq.')
      })

      it('keeps versions of a page and restores one into the working copy', async () => {
        const { entry } = await create('page', 'publish', { title: 'Stara', slug: 'wersje' })
        await api.post(
          `/admin/content/entries/${entry.id}`,
          { mode: 'publish', data: { title: 'Nowa', slug: 'wersje' } },
          { headers: admin },
        )
        const versions = (
          await api.get(`/admin/content/entries/${entry.id}/versions`, { headers: admin })
        ).data.versions
        expect(versions).toHaveLength(2)
        const oldest = versions[versions.length - 1]
        const restored = (
          await api.post(`/admin/content/versions/${oldest.id}/restore`, {}, { headers: admin })
        ).data.entry
        expect(restored.draft.title).toBe('Stara')
        expect(restored.data.title).toBe('Nowa')
      })

      it('binds content to a product, serves it by handle and records a rename (Review Focus 6)', async () => {
        const product = await createTestProduct(container, storeId.salesChannelId, {
          handle: 'deska-a',
        })
        await api.post(
          `/admin/content/catalog/product/${product.id}`,
          { mode: 'publish', data: { tagline: 'Lekka' } },
          { headers: admin },
        )
        const found = (await storeGet('/store/content/catalog/product/deska-a')).data.content
        expect(found).toMatchObject({ tagline: 'Lekka', handle: 'deska-a' })
        expect((await storeGet('/store/content/catalog/product/nie-ma')).data.content).toBeNull()
        const unknown = await failed(storeGet('/store/content/catalog/nope/x'))
        expect(unknown.status).toBe(404)
        expect(unknown.data.message).toBe('Nieznany typ treści: nope.')

        // first sight records the mirror; the rename leaves a redirect and an event
        await container.resolve('product').updateProducts(product.id, { handle: 'deska-a' })
        const moved = nextEvent(container, 'content.handle-changed')
        await api.post(`/admin/products/${product.id}`, { handle: 'deska-b' }, { headers: admin })
        await expect(moved).resolves.toMatchObject({
          kind: 'product',
          old_handle: 'deska-a',
          handle: 'deska-b',
        })
        const redirect = (await storeGet('/store/content/moved?kind=product&handle=deska-a')).data
        expect(redirect.handle).toBe('deska-b')
        expect(
          (await storeGet('/store/content/moved?kind=product&handle=deska-b')).data.handle,
        ).toBeNull()
      })
    })
  },
})

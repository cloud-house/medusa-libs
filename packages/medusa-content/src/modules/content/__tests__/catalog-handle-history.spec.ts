import { z } from '@medusajs/framework/zod'
import { moduleIntegrationTestRunner } from '@medusajs/test-utils'
import catalogHandleHistory, { config } from '../../../subscribers/catalog-handle-history'
import { ContentEvents } from '../../../workflows/events'
import { CONTENT_MODULE } from '..'
import { ContentEntry } from '../models/content-entry'
import { ContentRef } from '../models/content-ref'
import { ContentVersion } from '../models/content-version'
import { CatalogHandle, HandleRedirect } from '../models/handle-redirect'
import { MediaAsset } from '../models/media-asset'
import type ContentModuleService from '../service'

jest.setTimeout(60 * 1000)

const any = z.object({}).passthrough()
const kinds = [
  { type: 'page', label: 'Page', schema: any },
  { type: 'product', label: 'Product', schema: any, entity: 'product' as const },
  { type: 'brand', label: 'Brand', schema: any, entity: 'brand' as const },
]

moduleIntegrationTestRunner<ContentModuleService>({
  moduleName: CONTENT_MODULE,
  moduleModels: [
    ContentEntry,
    ContentVersion,
    ContentRef,
    MediaAsset,
    CatalogHandle,
    HandleRedirect,
  ],
  resolve: './src/modules/content',
  moduleOptions: { kinds },
  testSuite: ({ service }) => {
    const emit = jest.fn()
    let productHandle = 'deska-a'
    const container = {
      resolve: (key: string) => {
        if (key === CONTENT_MODULE) return service
        if (key === 'logger') return { warn: jest.fn() }
        if (key === 'event_bus') return { emit }
        if (key === 'product') {
          return {
            listProducts: async () => [{ handle: productHandle }],
            listProductCategories: async () => [],
          }
        }
        throw new Error(`unexpected ${key}`)
      },
    } as never
    const fire = (name: string, data: Record<string, unknown> = { id: 'prod_1' }) =>
      catalogHandleHistory({ event: { name, data }, container } as never)

    describe('catalog handle history (Review Focus 6)', () => {
      beforeEach(() => emit.mockClear())

      it('subscribes to product, category and brand events under the content namespace', () => {
        expect(config.event).toEqual(expect.arrayContaining(['product.updated', 'brand.deleted']))
        expect(ContentEvents).toEqual({
          CHANGED: 'content.changed',
          DELETED: 'content.deleted',
          HANDLE_CHANGED: 'content.handle-changed',
        })
      })

      it('records the handle on first sight and a redirect with an event on a rename', async () => {
        productHandle = 'deska-a'
        await fire('product.created')
        expect(emit).not.toHaveBeenCalled()
        productHandle = 'deska-b'
        await fire('product.updated')
        expect(emit).toHaveBeenCalledWith({
          name: 'content.handle-changed',
          data: { kind: 'product', id: 'prod_1', old_handle: 'deska-a', handle: 'deska-b' },
        })
        expect(await service.listHandleRedirects({ kind: 'product', entity_id: 'prod_1' })).toEqual(
          [expect.objectContaining({ old_handle: 'deska-a' })],
        )
      })

      it('does nothing twice for the same event and keeps a chain, not a loop', async () => {
        productHandle = 'deska-a'
        await fire('product.created')
        productHandle = 'deska-b'
        await fire('product.updated')
        emit.mockClear()
        await fire('product.updated') // same handle again
        expect(emit).not.toHaveBeenCalled()
        productHandle = 'deska-c'
        await fire('product.updated')
        expect(emit).toHaveBeenCalledTimes(1)
        const olds = (
          await service.listHandleRedirects({ kind: 'product', entity_id: 'prod_1' })
        ).map((row) => row.old_handle)
        expect(olds.sort()).toEqual(['deska-a', 'deska-b'])
        expect(olds).not.toContain('deska-c')
      })

      it('removes the content and redirects of a deleted product', async () => {
        productHandle = 'deska-a'
        await fire('product.created')
        productHandle = 'deska-b'
        await fire('product.updated')
        const entry = await service.createContentEntries({ type: 'product', entity_id: 'prod_1' })
        await service.createContentVersions({
          entry_id: entry.id,
          snapshot: {},
          status: 'published',
        })
        await fire('product.deleted')
        expect(await service.listContentEntries({ type: 'product', entity_id: 'prod_1' })).toEqual(
          [],
        )
        expect(await service.listContentVersions({ entry_id: entry.id })).toEqual([])
        expect(await service.listHandleRedirects({ entity_id: 'prod_1' })).toEqual([])
        expect(await service.listCatalogHandles({ entity_id: 'prod_1' })).toEqual([])
      })

      it('ignores events of kinds the shop did not bind to a record', async () => {
        await fire('product-category.created', { id: 'pcat_1' })
        expect(await service.listCatalogHandles({ kind: 'category' })).toEqual([])
      })

      it('takes a brand handle from the event', async () => {
        await fire('brand.created', { id: 'brand_1', handle: 'marka-a' })
        await fire('brand.updated', { id: 'brand_1', handle: 'marka-b' })
        expect(emit).toHaveBeenCalledWith({
          name: 'content.handle-changed',
          data: { kind: 'brand', id: 'brand_1', old_handle: 'marka-a', handle: 'marka-b' },
        })
      })
    })
  },
})

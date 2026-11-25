import { z } from '@medusajs/framework/zod'
import { moduleIntegrationTestRunner } from '@medusajs/test-utils'
import type { ContentKind } from '../../../kinds'
import { CONTENT_MODULE } from '..'
import { ContentEntry } from '../models/content-entry'
import { ContentRef } from '../models/content-ref'
import { ContentVersion } from '../models/content-version'
import { CatalogHandle, HandleRedirect } from '../models/handle-redirect'
import { MediaAsset } from '../models/media-asset'
import { CONFLICT_MESSAGE } from '../policy'
import type ContentModuleService from '../service'

jest.setTimeout(60 * 1000)

const any = z.object({}).passthrough()
const kinds: ContentKind[] = [
  { type: 'page', label: 'Page', schema: any, versions: { drafts: true, maxVersions: 0 } },
  { type: 'article', label: 'Article', schema: any, versions: { drafts: true, maxVersions: 50 } },
  { type: 'product', label: 'Product', schema: any, entity: 'product' },
  {
    type: 'global',
    slug: 'store-settings',
    label: 'Settings',
    schema: any,
    versions: { drafts: false, maxVersions: 0 },
  },
  { type: 'faq', label: 'FAQ', schema: any },
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
    const page = (slug = 'regulamin') =>
      service.createContentEntries({ type: 'page', slug, data: null, status: 'draft' })

    describe('ContentModuleService', () => {
      it('keeps the working copy apart from the published state', async () => {
        const entry = await page()
        await service.saveDraft({ id: entry.id, data: { title: 'Szkic' }, userId: 'user_1' })
        let row = await service.publish({ id: entry.id, userId: 'user_1' })
        expect(row).toMatchObject({ status: 'published', data: { title: 'Szkic' }, draft: null })
        expect(row.published_at).toBeInstanceOf(Date)
        const firstPublication = row.published_at

        row = await service.saveDraft({ id: entry.id, data: { title: 'Zmiana' } })
        expect(row).toMatchObject({ data: { title: 'Szkic' }, draft: { title: 'Zmiana' } })

        row = await service.publish({ id: entry.id })
        expect(row.data).toEqual({ title: 'Zmiana' })
        expect(row.published_at).toEqual(firstPublication)

        row = await service.unpublish({ id: entry.id })
        expect(row).toMatchObject({ status: 'draft', draft: { title: 'Zmiana' } })
      })

      it('folds autosaves of one editor into one rolling version', async () => {
        const entry = await page()
        for (const title of ['a', 'ab', 'abc']) {
          await service.saveDraft({ id: entry.id, data: { title }, autosave: true, userId: 'u1' })
        }
        await service.saveDraft({
          id: entry.id,
          data: { title: 'x' },
          autosave: true,
          userId: 'u2',
        })
        const versions = await service.listVersions(entry.id)
        expect(versions.map((version) => version.snapshot)).toEqual([
          { title: 'x' },
          { title: 'abc' },
        ])

        await service.publish({ id: entry.id })
        await service.saveDraft({
          id: entry.id,
          data: { title: 'po' },
          autosave: true,
          userId: 'u2',
        })
        expect(await service.listVersions(entry.id)).toHaveLength(4)
      })

      it('keeps every version of a page and the newest 50 of an article', async () => {
        const entry = await page()
        const article = await service.createContentEntries({ type: 'article', slug: 'wiosla' })
        for (let index = 0; index < 52; index += 1) {
          await service.publish({ id: entry.id, data: { title: `v${index}` } })
          await service.publish({ id: article.id, data: { title: `v${index}` } })
        }
        expect(await service.listVersions(entry.id)).toHaveLength(52)
        const articleVersions = await service.listVersions(article.id)
        expect(articleVersions).toHaveLength(50)
        expect(articleVersions[0]?.snapshot).toEqual({ title: 'v51' })
      })

      it('keeps no history for content saved directly', async () => {
        const entry = await service.createContentEntries({ type: 'product', entity_id: 'prod_1' })
        await service.publish({ id: entry.id, data: { features: [] } })
        expect(await service.listVersions(entry.id)).toEqual([])
        await expect(service.saveDraft({ id: entry.id, data: {} })).rejects.toThrow(
          'Ta treść nie ma wersji roboczych.',
        )
      })

      it('refuses a write based on an older state', async () => {
        const entry = await page()
        const saved = await service.saveDraft({ id: entry.id, data: { title: 'a' } })
        await service.saveDraft({
          id: entry.id,
          data: { title: 'b' },
          expectedUpdatedAt: saved.updated_at,
        })
        await expect(
          service.saveDraft({
            id: entry.id,
            data: { title: 'c' },
            expectedUpdatedAt: saved.updated_at,
          }),
        ).rejects.toThrow(CONFLICT_MESSAGE)
      })

      it('finds the version published at a given moment', async () => {
        const entry = await page()
        await service.publish({ id: entry.id, data: { title: 'pierwsza' } })
        const between = new Date()
        await new Promise((resolve) => setTimeout(resolve, 20))
        await service.publish({ id: entry.id, data: { title: 'druga' } })

        expect((await service.publishedVersionAt(entry.id, between))?.snapshot).toEqual({
          title: 'pierwsza',
        })
        expect((await service.publishedVersionAt(entry.id, new Date()))?.snapshot).toEqual({
          title: 'druga',
        })
        expect(await service.publishedVersionAt(entry.id, new Date(2020, 0, 1))).toBeNull()
      })

      it('restores a version into the working copy, store settings straight away', async () => {
        const entry = await page()
        await service.publish({ id: entry.id, data: { title: 'stara' } })
        await service.publish({ id: entry.id, data: { title: 'nowa' } })
        const old = (await service.listVersions(entry.id)).slice(-1)[0]
        const row = await service.restoreVersion({ versionId: old?.id ?? '' })
        expect(row).toMatchObject({ data: { title: 'nowa' }, draft: { title: 'stara' } })

        const settings = await service.createContentEntries({
          type: 'global',
          slug: 'store-settings',
        })
        await service.publish({ id: settings.id, data: { returnDays: 30 } })
        await service.publish({ id: settings.id, data: { returnDays: 14 } })
        const first = (await service.listVersions(settings.id)).slice(-1)[0]
        const restored = await service.restoreVersion({ versionId: first?.id ?? '' })
        expect(restored).toMatchObject({ status: 'published', data: { returnDays: 30 } })
      })

      it('stores an entry of any registered kind – the type is free text (migration 20261125140000)', async () => {
        const faq = await service.createContentEntries({ type: 'faq', slug: 'zwroty' })
        expect(faq.type).toBe('faq')
        await service.publish({ id: faq.id, data: { q: 'Jak zwrócić?' } })
        // type + slug stay unique
        await expect(
          service.createContentEntries({ type: 'faq', slug: 'zwroty' }),
        ).rejects.toThrow()
        // the same slug under another type is fine
        await expect(
          service.createContentEntries({ type: 'page', slug: 'zwroty' }),
        ).resolves.toBeTruthy()
      })

      it('exposes the plugin options and the registry', () => {
        expect(service.getOptions().registry.get('faq')?.label).toBe('FAQ')
        expect(service.getOptions().previewHeader).toBe('x-preview-token')
      })

      it('tracks what an entry uses, per state', async () => {
        const article = await service.createContentEntries({ type: 'article', slug: 'a' })
        await service.replaceRefs(article.id, 'published', [
          { target_type: 'media', target_id: 'med_1' },
          { target_type: 'media', target_id: 'med_1' },
        ])
        await service.replaceRefs(article.id, 'draft', [
          { target_type: 'product', target_id: 'p1' },
        ])
        expect(await service.entriesUsing({ target_type: 'media', target_id: 'med_1' })).toEqual([
          { id: article.id, type: 'article', slug: 'a', title: null },
        ])
        await service.replaceRefs(article.id, 'published', [])
        expect(await service.entriesUsing({ target_type: 'media', target_id: 'med_1' })).toEqual([])
        expect(
          await service.entriesUsing({ target_type: 'product', target_id: 'p1' }, article.id),
        ).toEqual([])
      })
    })
  },
})

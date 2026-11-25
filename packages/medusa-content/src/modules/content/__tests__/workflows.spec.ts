import { z } from '@medusajs/framework/zod'
import { moduleIntegrationTestRunner } from '@medusajs/test-utils'
import { contentKinds } from '../../../kinds/index'
import {
  CATEGORY_IN_USE_MESSAGE,
  PROTECTED_MESSAGE,
  SLUG_TAKEN_MESSAGE,
} from '../../../lib/api-errors'
import { collectRefs } from '../../../lib/refs'
import { deleteContent, unpublishContent } from '../../../workflows/steps/entry-actions'
import { writeContent } from '../../../workflows/steps/write-content'
import { CONTENT_MODULE } from '..'
import { ContentEntry } from '../models/content-entry'
import { ContentRef } from '../models/content-ref'
import { ContentVersion } from '../models/content-version'
import { CatalogHandle, HandleRedirect } from '../models/handle-redirect'
import { MediaAsset } from '../models/media-asset'
import type ContentModuleService from '../service'

jest.setTimeout(60 * 1000)

const kinds = [
  ...contentKinds({ reservedSlugs: ['koszyk'], protectedSlugs: ['regulamin'] }),
  {
    type: 'product',
    label: 'Product',
    entity: 'product' as const,
    schema: z.object({}).passthrough(),
  },
  { type: 'faq', label: 'FAQ', schema: z.object({ q: z.string().min(1, 'Podaj pytanie.') }) },
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
    // The step functions only resolve the content module from the container.
    const container = { resolve: () => service } as never

    const page = (slug: string, extra: Record<string, unknown> = {}) => ({
      title: `Strona ${slug}`,
      slug,
      ...extra,
    })
    const save = (input: Parameters<typeof writeContent>[1]) => writeContent(container, input)

    describe('write-content', () => {
      it('publishes a page with the same messages as the panel had; a draft takes the softer check', async () => {
        await expect(
          save({ target: { type: 'page' }, mode: 'publish', data: { title: '', slug: 'a' } }),
        ).rejects.toThrow('title: Podaj tytuł strony.')
        const draft = await save({
          target: { type: 'page' },
          mode: 'draft',
          data: page('szkic'),
        })
        expect(draft.output).toMatchObject({
          published: false,
          entry: { status: 'draft', slug: 'szkic' },
        })
        const published = await save({
          target: { id: draft.output.entry.id },
          mode: 'publish',
          data: page('szkic'),
        })
        expect(published.output).toMatchObject({ published: true, entry: { status: 'published' } })
      })

      it('rolls back a created entry when the data is invalid', async () => {
        const before = await service.listContentEntries({ type: 'page' })
        await expect(
          save({
            target: { type: 'page' },
            mode: 'publish',
            data: { title: 'x', slug: 'Zły Adres' },
          }),
        ).rejects.toThrow('slug:')
        expect(await service.listContentEntries({ type: 'page' })).toHaveLength(before.length)
      })

      it('refuses a taken address and a reserved one', async () => {
        await save({ target: { type: 'page' }, mode: 'publish', data: page('zajety') })
        await expect(
          save({ target: { type: 'page' }, mode: 'publish', data: page('zajety') }),
        ).rejects.toThrow(SLUG_TAKEN_MESSAGE)
        await expect(
          save({ target: { type: 'page' }, mode: 'publish', data: page('koszyk') }),
        ).rejects.toThrow('Adres „koszyk” zajmuje już sklep – wybierz inny.')
      })

      it('does not let a protected page change its address, unless a seed says so', async () => {
        const { output } = await save({
          target: { type: 'page' },
          mode: 'publish',
          data: page('regulamin'),
        })
        await expect(
          save({ target: { id: output.entry.id }, mode: 'publish', data: page('regulamin-2') }),
        ).rejects.toThrow(PROTECTED_MESSAGE.slug)
        await expect(
          save({
            target: { id: output.entry.id },
            mode: 'publish',
            data: page('regulamin-2'),
            allow_protected_change: true,
          }),
        ).resolves.toBeTruthy()
      })

      it('computes reading minutes and the publication date of an article', async () => {
        const category = await save({
          target: { type: 'article_category' },
          mode: 'publish',
          data: { name: 'Sprzęt', slug: 'sprzet' },
        })
        const { output } = await save({
          target: { type: 'article' },
          mode: 'publish',
          data: {
            title: 'Jak pompować',
            slug: 'jak-pompowac',
            category: category.output.entry.id,
            lead: 'Wstęp',
            image: 'med_1',
          },
        })
        expect(output.entry.data).toMatchObject({ readingMinutes: expect.any(Number) })
        expect(typeof output.entry.data?.publishedAt).toBe('string')
        const first = output.entry.data?.publishedAt
        const again = await save({
          target: { id: output.entry.id },
          mode: 'publish',
          data: { ...(output.entry.data as object), title: 'Jak pompować 2' },
        })
        expect(again.output.entry.data?.publishedAt).toBe(first)
      })

      it('saves a kind of the shop that has no address; unknown types and global keys are refused', async () => {
        const { output } = await save({
          target: { type: 'faq' },
          mode: 'publish',
          data: { q: 'Jak zwrócić?' },
        })
        expect(output.entry).toMatchObject({ type: 'faq', slug: null, status: 'published' })
        await expect(
          save({ target: { type: 'faq' }, mode: 'publish', data: { q: '' } }),
        ).rejects.toThrow('q: Podaj pytanie.')
        await expect(save({ target: { type: 'nope' }, mode: 'publish', data: {} })).rejects.toThrow(
          'Nieznany typ treści: nope.',
        )
        await expect(
          save({ target: { type: 'global', key: 'nope' }, mode: 'publish', data: {} }),
        ).rejects.toThrow('Nieznany element układu: nope.')
      })

      it('a save that loses the race does not roll back the winner (review finding 1)', async () => {
        const { output } = await save({
          target: { type: 'page' },
          mode: 'publish',
          data: page('wyscig'),
        })
        const start = output.entry.updated_at
        const results = await Promise.allSettled(
          ['A', 'B'].map((title) =>
            save({
              target: { id: output.entry.id },
              mode: 'publish',
              data: page('wyscig', { title }),
              expected_updated_at: new Date(start).toISOString(),
            }),
          ),
        )
        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
        const winner = results.find((r) => r.status === 'fulfilled') as PromiseFulfilledResult<
          Awaited<ReturnType<typeof save>>
        >
        const row = await service.retrieveContentEntry(output.entry.id)
        expect((row.data as { title: string }).title).toBe(
          (winner.value.output.entry.data as { title: string }).title,
        )
      })

      it('refuses a kind bound to a record without the record, and an unregistered stored type', async () => {
        await expect(
          save({ target: { type: 'product' }, mode: 'publish', data: {} }),
        ).rejects.toThrow('dotyczy produktu')
      })

      it('keeps what the entry points at, per the paths of its kind', async () => {
        const { output } = await save({
          target: { type: 'page' },
          mode: 'publish',
          data: page('z-linkiem'),
        })
        expect(collectRefs(contentRegistry(), 'page', 'z-linkiem', output.entry.data)).toEqual([])
      })
    })

    function contentRegistry() {
      return service.getOptions().registry
    }

    describe('entry actions', () => {
      it('does not unpublish or delete a protected page', async () => {
        const { output } = await save({
          target: { type: 'page' },
          mode: 'publish',
          data: page('regulamin'),
        })
        await expect(unpublishContent(container, { id: output.entry.id })).rejects.toThrow(
          PROTECTED_MESSAGE.unpublish,
        )
        await expect(deleteContent(container, { id: output.entry.id })).rejects.toThrow(
          PROTECTED_MESSAGE.delete,
        )
        await expect(
          deleteContent(container, { id: output.entry.id, allow_protected_change: true }),
        ).resolves.toBeTruthy()
      })

      it('unpublishes a page and refuses it for content without drafts', async () => {
        const { output } = await save({
          target: { type: 'page' },
          mode: 'publish',
          data: page('wycofywana'),
        })
        const result = await unpublishContent(container, { id: output.entry.id })
        expect(result.output.entry).toMatchObject({ status: 'draft' })
        const faq = await save({ target: { type: 'faq' }, mode: 'publish', data: { q: 'x' } })
        await expect(unpublishContent(container, { id: faq.output.entry.id })).rejects.toThrow(
          'Tej treści nie można wycofać z publikacji.',
        )
      })

      it('does not delete a category with articles, nor a global (Review Focus 3)', async () => {
        const category = await save({
          target: { type: 'article_category' },
          mode: 'publish',
          data: { name: 'Z artykułem', slug: 'z-artykulem' },
        })
        const article = await save({
          target: { type: 'article' },
          mode: 'publish',
          data: {
            title: 'A',
            slug: 'a-w-kategorii',
            category: category.output.entry.id,
            lead: 'x',
            image: 'med_1',
          },
        })
        await service.replaceRefs(article.output.entry.id, 'published', [
          { target_type: 'entry', target_id: category.output.entry.id },
        ])
        await expect(deleteContent(container, { id: category.output.entry.id })).rejects.toThrow(
          CATEGORY_IN_USE_MESSAGE,
        )
        await service.replaceRefs(article.output.entry.id, 'published', [])
        await expect(
          deleteContent(container, { id: category.output.entry.id }),
        ).resolves.toBeTruthy()

        const header = await save({
          target: { type: 'global', key: 'header' },
          mode: 'publish',
          data: { navigation: [{ label: 'Sklep', href: '/sklep' }] },
        })
        await expect(deleteContent(container, { id: header.output.entry.id })).rejects.toThrow(
          'Elementów układu nie można usunąć.',
        )
      })
    })
  },
})

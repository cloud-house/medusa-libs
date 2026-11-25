import { z } from '@medusajs/framework/zod'
import { KindRegistry } from '../../kinds'
import { emptyLookups } from '../../lib/populate'
import type { EntryRow } from '../../types'
import { contentKinds, homeBlockBase, homePageKind, homeText, pageKind } from '..'

const registry = new KindRegistry(contentKinds({ reservedSlugs: ['koszyk', 'poradnik'] }))

const issues = (
  type: string,
  slug: string | null,
  data: unknown,
  mode: 'publish' | 'draft' = 'publish',
) => {
  const result = registry.schemaFor(type, slug, mode).safeParse(data)
  return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

const doc = (...children: unknown[]) => ({ root: { type: 'root', children } })
const internalLink = (relationTo: string) => ({
  type: 'link',
  fields: { linkType: 'internal', doc: { relationTo, value: 'x' } },
  children: [],
})

describe('ready-made kinds', () => {
  it('contentKinds() is a valid registry with the policies the shop had', () => {
    expect(registry.policyFor('page', null)).toEqual({ drafts: true, maxVersions: 0 })
    expect(registry.policyFor('article', null)).toEqual({ drafts: true, maxVersions: 50 })
    expect(registry.policyFor('article_category', null)).toEqual({
      drafts: false,
      maxVersions: null,
    })
    expect(registry.policyFor('global', 'home-page')).toEqual({ drafts: true, maxVersions: 50 })
    expect(registry.policyFor('global', 'store-settings')).toEqual({
      drafts: false,
      maxVersions: 0,
    })
    expect(registry.policyFor('global', 'header')).toEqual({ drafts: false, maxVersions: null })
    expect(registry.globalKeys().sort()).toEqual(
      ['announcement-bar', 'footer', 'header', 'home-page', 'store-settings'].sort(),
    )
  })

  it('accepts a page and normalises empty texts', () => {
    const result = registry.schemaFor('page', null, 'publish').parse({
      title: ' Regulamin ',
      slug: 'regulamin',
      lead: '   ',
      content: doc({ type: 'paragraph', children: [] }),
    })
    expect(result).toMatchObject({ title: 'Regulamin', lead: null, inInfoNav: true, navOrder: 100 })
  })

  it('refuses reserved page addresses from the options and links outside the shop', () => {
    expect(issues('page', null, { title: 'K', slug: 'koszyk' })).toContain(
      'Adres „koszyk” zajmuje już sklep – wybierz inny.',
    )
    expect(issues('page', null, { title: 'K', slug: 'admin' })).toContain(
      'Adres „admin” zajmuje już sklep – wybierz inny.',
    )
    expect(
      issues('page', null, { title: 'A', slug: 'a', content: doc(internalLink('users')) }),
    ).toEqual([
      'Link wewnętrzny może prowadzić tylko do strony, artykułu, produktu, kategorii albo marki.',
    ])
    // without the option the shop's own addresses are free
    const bare = new KindRegistry([pageKind()])
    expect(
      bare.schemaFor('page', null, 'publish').safeParse({ title: 'K', slug: 'koszyk' }).success,
    ).toBe(true)
  })

  it('carries the protected pages of the option', () => {
    const kind = pageKind({ protectedSlugs: ['regulamin'] })
    expect(kind.protectedSlugs).toEqual(['regulamin'])
    expect(pageKind().protectedSlugs).toEqual([])
  })

  it('checks page blocks', () => {
    const setting = (key: string) => ({
      type: 'inlineBlock',
      fields: { blockType: 'settingValue', key },
    })
    expect(
      issues('page', null, { title: 'A', slug: 'a', content: doc(setting('returnDays')) }),
    ).toEqual([])
    expect(issues('page', null, { title: 'A', slug: 'a', content: doc(setting('nope')) })).toEqual([
      'Wybierz wartość z ustawień sklepu.',
    ])
    expect(
      issues('page', null, {
        title: 'A',
        slug: 'a',
        content: doc({ type: 'block', fields: { blockType: 'productCards' } }),
      }),
    ).toEqual(['Nieznany blok „productCards”.'])
  })

  it('requires category and image only when an article is published', () => {
    const draft = { title: 'Jak pompować', slug: 'jak-pompowac' }
    expect(issues('article', null, draft, 'draft')).toEqual([])
    expect(issues('article', null, draft)).toEqual(
      expect.arrayContaining(['Wybierz kategorię.', 'Podaj wstęp.', 'Wybierz zdjęcie główne.']),
    )
    const cards = (products: string[]) =>
      doc({ type: 'block', fields: { blockType: 'productCards', products } })
    expect(issues('article', null, { ...draft, content: cards([]) }, 'draft')).toEqual([
      'Wybierz od 1 do 3 produktów.',
    ])
  })

  it('checks the header, store settings and the link addresses', () => {
    expect(issues('global', 'header', { navigation: [] })).toEqual([
      'Menu ma co najmniej jedną pozycję.',
    ])
    expect(
      issues('global', 'store-settings', {
        shippingCutoff: '14:00',
        returnDays: 7,
        warrantyYears: 2,
      }),
    ).toEqual(['Na zwrot są co najmniej 14 dni.'])
  })

  it('applies the home layout rules on publish only', () => {
    const trust = { id: 't', blockType: 'trustBar', items: [{ title: 'A' }, { title: 'B' }] }
    expect(issues('global', 'home-page', { layout: [trust] })).toEqual([
      'Hero musi być pierwszym blokiem strony głównej.',
    ])
    expect(issues('global', 'home-page', { layout: [trust] }, 'draft')).toEqual([])
    expect(
      issues('global', 'home-page', {
        layout: [{ ...trust, items: [{ title: '{nieznany}' }, { title: 'B' }] }],
      }),
    ).toEqual(expect.arrayContaining([expect.stringContaining('Nieznany znacznik {nieznany}')]))
  })
})

describe('home page with extra blocks', () => {
  const promo = {
    type: 'promo',
    label: 'Promo',
    single: true,
    schema: z.object({
      ...homeBlockBase,
      blockType: z.literal('promo'),
      title: homeText(40, true),
      image: z.string().nullish(),
    }),
    refs: [['layout.*.image', 'media']] as [string, 'media'][],
    view: (raw: Record<string, unknown>, id: string) => ({
      type: 'promo',
      id,
      title: String(raw.title),
    }),
  }
  const withPromo = new KindRegistry([homePageKind({ extraBlocks: [promo] })])
  const hero = {
    id: 'h',
    blockType: 'hero',
    title: 'T',
    image: 'med_1',
    cta: { label: 'Go', href: '/' },
  }
  const parse = (layout: unknown[]) =>
    withPromo.schemaFor('global', 'home-page', 'publish').safeParse({ layout })

  it('accepts a registered extra block and rejects an unknown one', () => {
    expect(parse([hero, { id: 'p', blockType: 'promo', title: 'Quiz' }]).success).toBe(true)
    expect(parse([hero, { id: 'x', blockType: 'unknownBlock' }]).success).toBe(false)
  })

  it('applies label and single rule of the extra block', () => {
    const result = parse([
      hero,
      { id: 'p', blockType: 'promo', title: 'A' },
      { id: 'q', blockType: 'promo', title: 'B' },
    ])
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Blok „Promo” może wystąpić tylko raz.')
  })

  it('contributes its reference paths', () => {
    expect(withPromo.refPathsFor('global', 'home-page')).toContainEqual(['layout.*.image', 'media'])
  })

  it('its store view maps the core blocks and the extra ones, and skips unknown rows', () => {
    const kind = homePageKind({ extraBlocks: [promo] })
    const view = kind.view?.(
      {
        row: { type: 'global', slug: 'home-page' } as EntryRow,
        data: {
          layout: [
            { id: 'a', blockType: 'articles', heading: 'Blog' },
            { id: 'p', blockType: 'promo', title: 'Quiz' },
            { id: 'z', blockType: 'unknown' },
          ],
        },
      },
      { container: {} as never, registry: withPromo, draft: false, lookups: emptyLookups() },
    ) as { blocks: { type: string }[] }
    expect(view.blocks.map((block) => block.type)).toEqual(['articles', 'promo'])
  })
})

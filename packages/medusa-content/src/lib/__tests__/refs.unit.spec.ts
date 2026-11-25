import { z } from '@medusajs/framework/zod'
import { KindRegistry } from '../../kinds'
import { emptyLookups, populate } from '../populate'
import { collectRefs, mapRefs } from '../refs'

const any = z.object({}).passthrough()
const registry = new KindRegistry([
  {
    type: 'article',
    label: 'Article',
    schema: any,
    refs: [
      ['image', 'media'],
      ['category', 'entry'],
      ['content', 'lexical'],
    ],
  },
  {
    type: 'global',
    slug: 'home-page',
    label: 'Home',
    schema: any,
    refs: [
      ['layout.*.image', 'media'],
      ['layout.*.product', 'product'],
      ['layout.*.tiles.*.category', 'category'],
    ],
  },
  { type: 'global', slug: 'header', label: 'Header', schema: any },
  {
    type: 'product',
    label: 'Product',
    schema: any,
    entity: 'product',
    refs: [
      ['features.*.image', 'media'],
      ['accessories.*', 'product'],
      ['downloads.*.file', 'media'],
    ],
  },
  { type: 'faq', label: 'FAQ', schema: any },
])

const lexical = {
  root: {
    type: 'root',
    children: [
      { type: 'upload', relationTo: 'media', value: 'med_2' },
      {
        type: 'paragraph',
        children: [
          {
            type: 'link',
            fields: { linkType: 'internal', doc: { relationTo: 'articles', value: 'cnt_a' } },
            children: [],
          },
        ],
      },
      { type: 'block', fields: { blockType: 'productCards', products: ['prod_1', 'prod_gone'] } },
    ],
  },
}

describe('content references (by the paths of the registered kind)', () => {
  it('collects references of an article, Lexical included', () => {
    expect(
      collectRefs(registry, 'article', 'a', {
        image: 'med_1',
        category: 'cnt_c',
        content: lexical,
      }),
    ).toEqual([
      { target_type: 'media', target_id: 'med_1' },
      { target_type: 'entry', target_id: 'cnt_c' },
      { target_type: 'media', target_id: 'med_2' },
      { target_type: 'entry', target_id: 'cnt_a' },
      { target_type: 'product', target_id: 'prod_1' },
      { target_type: 'product', target_id: 'prod_gone' },
    ])
  })

  it('collects home page blocks and nothing for a kind without paths', () => {
    const layout = [
      { blockType: 'hero', image: 'med_1', product: 'prod_1' },
      { blockType: 'categoryTiles', tiles: [{ category: 'pcat_1', image: null }] },
    ]
    expect(collectRefs(registry, 'global', 'home-page', { layout })).toEqual([
      { target_type: 'media', target_id: 'med_1' },
      { target_type: 'product', target_id: 'prod_1' },
      { target_type: 'category', target_id: 'pcat_1' },
    ])
    expect(collectRefs(registry, 'global', 'header', { navigation: [] })).toEqual([])
    expect(collectRefs(registry, 'faq', null, { image: 'med_1' })).toEqual([])
    expect(collectRefs(registry, 'unknown', null, { image: 'med_1' })).toEqual([])
  })

  it('populates documents; a missing one becomes null', () => {
    const lookups = emptyLookups()
    lookups.media.set('med_1', {
      id: 'med_1',
      url: 'https://cdn/x.webp',
      alt: 'Deska',
      width: 800,
      height: 600,
      credit: null,
      creditUrl: null,
      filesize: 2_516_582,
      filename: 'x.webp',
      mimeType: 'image/webp',
    })
    lookups.product.set('prod_1', {
      id: 'prod_1',
      handle: 'pompa',
      title: 'Pompa',
      medusaStatus: 'active',
    })
    const doc = populate(
      registry,
      'product',
      null,
      {
        features: [{ label: 'A', image: 'med_1' }],
        accessories: ['prod_1', 'prod_gone'],
        downloads: [{ title: 'Instrukcja', file: 'med_1' }],
      },
      lookups,
    ) as {
      features: { image: { url: string; alt: string } }[]
      accessories: ({ handle: string } | null)[]
      downloads: { file: { filename: string } }[]
    }
    expect(doc.features[0]?.image).toMatchObject({ url: 'https://cdn/x.webp', alt: 'Deska' })
    expect(doc.accessories).toEqual([expect.objectContaining({ handle: 'pompa' }), null])
    expect(doc.downloads[0]?.file.filename).toBe('x.webp')
  })

  it('replaces ids without touching the rest of the data', () => {
    const data = { image: 'med_1', title: 'x', other: ['med_1'] }
    expect(mapRefs(registry, 'article', 'a', data, (_kind, id) => `[${id}]`)).toEqual({
      image: '[med_1]',
      title: 'x',
      other: ['med_1'],
    })
    expect(data.image).toBe('med_1')
  })
})

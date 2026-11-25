import { describe, expect, it } from 'vitest'
import { type ExtraBlockMapper, mapHomePage, text } from './home-views'

const media = (id: number) => ({
  id,
  url: `/api/media/file/${id}.jpg`,
  alt: `Zdjęcie ${id}`,
  width: 1200,
  height: 800,
  credit: 'Nick Fewings',
  creditUrl: 'https://unsplash.com/@jannerboy62',
})

const DOC = {
  _status: 'published',
  metaTitle: 'ChoNaSupa – deski SUP',
  metaDescription: ' Opis ',
  layout: [
    {
      id: 'b1',
      blockType: 'hero',
      eyebrow: 'Sezon 2026',
      title: 'Odkryj nowy wymiar pływania',
      image: media(1),
      cta: { label: 'Przeglądaj deski', href: '/deski-sup' },
      secondaryCta: { label: 'Znajdź SUP – quiz', href: '/quiz' },
      product: { id: 5, handle: 'allround-wave' },
    },
    { id: 'b2', blockType: 'trustBar', items: [{ title: 'Darmowa wysyłka', text: '' }] },
    {
      id: 'b3',
      blockType: 'categoryTiles',
      heading: 'Wybierz według przeznaczenia',
      intro: null,
      tiles: [
        { category: { id: 1, handle: 'allround' }, subtitle: 'Uniwersalne', image: media(2) },
        { category: null, subtitle: 'Usunięta', image: null },
        { category: 7, subtitle: 'Niewypełniona', image: null },
      ],
    },
    {
      id: 'b4',
      blockType: 'brands',
      eyebrow: 'Marki',
      heading: 'Marki',
      text: null,
      link: { label: 'Wszystkie marki', href: '' },
    },
    {
      id: 'b5',
      blockType: 'productTabs',
      tabs: [
        { label: 'Bestsellery', sort: 'popular', category: { id: 3, handle: 'deski-sup' } },
        { label: 'Nowości', sort: 'newest', category: null },
      ],
      link: { label: 'Wszystkie deski', href: '/deski-sup' },
    },
    {
      id: 'b6',
      blockType: 'newsletter',
      eyebrow: null,
      heading: 'Newsletter',
      text: 'Tekst',
      image: media(3),
    },
    { id: 'b7', blockType: 'articles', heading: 'Poradnik', link: null },
    { id: 'b10', blockType: 'videoBlock' },
  ],
}

describe('mapHomePage', () => {
  it('mapuje bloki w kolejności z panelu i pomija nieznane typy', () => {
    const page = mapHomePage(DOC)
    expect(page?.blocks.map((block) => block.type)).toEqual([
      'hero',
      'trustBar',
      'categoryTiles',
      'brands',
      'productTabs',
      'newsletter',
      'articles',
    ])
    expect(page?.metaTitle).toBe('ChoNaSupa – deski SUP')
    expect(page?.metaDescription).toBe('Opis')
  })

  it('hero: zdjęcie, przycisk i handle produktu ze zdjęcia', () => {
    const hero = mapHomePage(DOC)?.blocks[0]
    expect(hero).toMatchObject({
      type: 'hero',
      id: 'b1',
      eyebrow: 'Sezon 2026',
      cta: { label: 'Przeglądaj deski', href: '/deski-sup' },
      secondaryCta: { label: 'Znajdź SUP – quiz', href: '/quiz' },
      productHandle: 'allround-wave',
      image: { url: '/api/media/file/1.jpg', alt: 'Zdjęcie 1', credit: 'Nick Fewings' },
    })
  })

  it('hero bez drugiego przycisku – null', () => {
    const { secondaryCta: _, ...heroWithout } = DOC.layout[0] as Record<string, unknown>
    const page = mapHomePage({ ...DOC, layout: [heroWithout] })
    expect(page?.blocks[0]).toMatchObject({ type: 'hero', secondaryCta: null })
  })

  it('blok dodatkowy sklepu mapuje przekazany mapper, a bez mappera jest pomijany', () => {
    type Promo = { type: 'promo'; id: string; title: string | null }
    const promo: ExtraBlockMapper<Promo> = (raw, id) => ({
      type: 'promo',
      id,
      title: text(raw.title),
    })
    const doc = { layout: [DOC.layout[0], { id: 'x1', blockType: 'promo', title: ' Quiz ' }] }
    expect(mapHomePage(doc, { promo })?.blocks.map((block) => block.type)).toEqual([
      'hero',
      'promo',
    ])
    expect(mapHomePage(doc, { promo })?.blocks[1]).toEqual({
      type: 'promo',
      id: 'x1',
      title: 'Quiz',
    })
    expect(mapHomePage(doc)?.blocks.map((block) => block.type)).toEqual(['hero'])
  })

  it('pomija kafle bez wypełnionej kategorii', () => {
    const blocks = mapHomePage(DOC)?.blocks ?? []
    const tiles = blocks.find((block) => block.type === 'categoryTiles')
    expect(tiles && 'tiles' in tiles && tiles.tiles.map((tile) => tile.handle)).toEqual([
      'allround',
    ])
  })

  it('link bez etykiety albo adresu to brak linku, pusty podpis to null', () => {
    const blocks = mapHomePage(DOC)?.blocks ?? []
    expect(blocks.find((block) => block.type === 'brands')).toMatchObject({ link: null })
    expect(blocks.find((block) => block.type === 'trustBar')).toMatchObject({
      items: [{ title: 'Darmowa wysyłka', text: null }],
    })
    expect(blocks.find((block) => block.type === 'productTabs')).toMatchObject({
      tabs: [
        { label: 'Bestsellery', sort: 'popular', categoryHandle: 'deski-sup' },
        { label: 'Nowości', sort: 'newest', categoryHandle: null },
      ],
      link: { label: 'Wszystkie deski', href: '/deski-sup' },
    })
  })

  it('pusty układ albo brak dokumentu → null', () => {
    expect(mapHomePage({ ...DOC, layout: [] })).toBeNull()
    expect(mapHomePage({ ...DOC, layout: null })).toBeNull()
    expect(mapHomePage(null)).toBeNull()
  })
})

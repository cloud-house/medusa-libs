import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { testSeo } from './fixtures'
import type { SeoProduct, SeoVariant } from './types'

const { buildMerchantFeed } = testSeo()

const MEDIA = 'https://media.sklep.pl'

const variant = (over: Partial<SeoVariant> = {}): SeoVariant => ({
  id: 'var_wave_106_turkus',
  path: '/produkt/allround-wave?kolor=turkus&rozmiar=10-6',
  sku: 'WAVE-106-T',
  gtin: null,
  size: `10'6"`,
  color: 'Turkus',
  images: [`${MEDIA}/wave-turkus-0.webp`, `${MEDIA}/wave-turkus-1.webp`],
  price: 1899,
  regularPrice: 2199,
  lowestPrice30d: null,
  inStock: true,
  shippingCost: 0,
  ...over,
})

const wave = (over: Partial<SeoProduct> = {}): SeoProduct => ({
  id: 'prod_wave',
  handle: 'allround-wave',
  title: 'Allround Wave',
  subtitle: 'Zestaw 5w1 z wiosłem',
  description: '<p>Uniwersalna deska na <strong>jezioro</strong> i rzekę.</p>',
  brand: 'Aqua Marina',
  categoryPath: ['Deski SUP', 'Allround'],
  googleCategory: 6288,
  images: [`${MEDIA}/wave-product-0.webp`],
  variants: [variant()],
  ...over,
})

const pump = (): SeoProduct =>
  wave({
    id: 'prod_pump',
    handle: 'pompka-12v',
    title: 'Pompka 12V',
    description: null,
    brand: null,
    categoryPath: ['Akcesoria', 'Pompki'],
    googleCategory: null,
    images: [`${MEDIA}/pump.webp`],
    variants: [
      variant({
        id: 'var_pump',
        path: '/produkt/pompka-12v',
        sku: 'PUMP',
        size: null,
        color: null,
        price: 449,
        regularPrice: 449,
        images: [],
        gtin: '5901234123457',
        shippingCost: 12.99,
      }),
    ],
  })

/** Treść pierwszego `<item>` z danym `g:id`. */
function item(xml: string, id: string): string {
  const found = xml.split('<item>').find((chunk) => chunk.includes(`<g:id>${id}</g:id>`))
  if (!found) throw new Error(`brak pozycji ${id}`)
  return found.split('</item>')[0] ?? ''
}
const tag = (chunk: string, name: string) =>
  chunk.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1]

beforeEach(() => {
  vi.stubEnv('SITE_URL', 'https://sklep.pl')
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('buildMerchantFeed', () => {
  it('RSS 2.0 with the g: namespace and a channel describing the shop', () => {
    const xml = buildMerchantFeed([wave()])
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain('<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">')
    expect(tag(xml, 'title')).toBe('Sklep Testowy – deski i akcesoria')
    expect(tag(xml, 'link')).toBe('https://sklep.pl/')
    expect(tag(xml, 'description')).toBe('Deski i akcesoria sprawdzonych marek.')
  })

  it('one item per variant: ids, title, variant link, prices, stock and attributes', () => {
    const entry = item(buildMerchantFeed([wave()]), 'var_wave_106_turkus')
    expect(tag(entry, 'g:item_group_id')).toBe('prod_wave')
    expect(tag(entry, 'title')).toBe('Aqua Marina Allround Wave 10&apos;6&quot; Turkus')
    expect(tag(entry, 'description')).toBe('Uniwersalna deska na jezioro i rzekę.')
    expect(tag(entry, 'link')).toBe(
      'https://sklep.pl/produkt/allround-wave?kolor=turkus&amp;rozmiar=10-6',
    )
    expect(tag(entry, 'g:price')).toBe('2199.00 PLN')
    expect(tag(entry, 'g:sale_price')).toBe('1899.00 PLN')
    expect(tag(entry, 'g:availability')).toBe('in_stock')
    expect(tag(entry, 'g:condition')).toBe('new')
    expect(tag(entry, 'g:brand')).toBe('Aqua Marina')
    expect(tag(entry, 'g:color')).toBe('Turkus')
    expect(tag(entry, 'g:size')).toBe('10&apos;6&quot;')
    expect(tag(entry, 'g:product_type')).toBe('Deski SUP &gt; Allround')
    expect(tag(entry, 'g:google_product_category')).toBe('6288')
    expect(tag(entry, 'g:identifier_exists')).toBe('no')
    expect(entry).not.toContain('<g:gtin>')
    expect(tag(entry, 'g:image_link')).toBe(`${MEDIA}/wave-turkus-0.webp`)
    expect(entry.match(/<g:additional_image_link>/g)).toHaveLength(1)
    expect(entry).not.toContain('wave-product-0.webp')
  })

  it('a size already in the model name is not repeated; a colour equal to the brand stays', () => {
    const mini = wave({
      title: `Mini Wave 8'0"`,
      variants: [variant({ size: `8'0"`, color: 'Żółty' })],
    })
    expect(tag(item(buildMerchantFeed([mini]), 'var_wave_106_turkus'), 'title')).toBe(
      'Aqua Marina Mini Wave 8&apos;0&quot; Żółty',
    )
    const red = wave({ brand: 'Red Paddle', title: 'Ride', variants: [variant({ color: 'Red' })] })
    expect(tag(item(buildMerchantFeed([red]), 'var_wave_106_turkus'), 'title')).toBe(
      'Red Paddle Ride 10&apos;6&quot; Red',
    )
  })

  it('a brand of only spaces is left out of the title and g:brand', () => {
    const blank = wave({ brand: '  ' })
    const entry = item(buildMerchantFeed([blank]), 'var_wave_106_turkus')
    expect(tag(entry, 'title')).toBe('Allround Wave 10&apos;6&quot; Turkus')
    expect(entry).not.toContain('<g:brand>')
  })

  it('a subtitle of only spaces or tags falls back to the title', () => {
    for (const subtitle of ['   ', '<p> </p>']) {
      const bare = wave({ description: null, subtitle })
      expect(tag(item(buildMerchantFeed([bare]), 'var_wave_106_turkus'), 'description')).toBe(
        'Allround Wave',
      )
    }
  })

  it('a regular price has no sale price', () => {
    const regular = wave({ variants: [variant({ price: 2199, regularPrice: 2199 })] })
    const entry = item(buildMerchantFeed([regular]), 'var_wave_106_turkus')
    expect(tag(entry, 'g:price')).toBe('2199.00 PLN')
    expect(entry).not.toContain('<g:sale_price>')
  })

  it('GTIN → gtin without identifier_exists; product photo when the variant has none', () => {
    const entry = item(buildMerchantFeed([pump()]), 'var_pump')
    expect(tag(entry, 'g:gtin')).toBe('5901234123457')
    expect(entry).not.toContain('identifier_exists')
    expect(tag(entry, 'g:image_link')).toBe(`${MEDIA}/pump.webp`)
    expect(entry).not.toContain('<g:brand>')
    expect(entry).not.toContain('<g:color>')
    expect(entry).not.toContain('<g:google_product_category>')
  })

  it('sold out → out_of_stock', () => {
    const soldOut = wave({ variants: [variant({ inStock: false })] })
    expect(tag(item(buildMerchantFeed([soldOut]), 'var_wave_106_turkus'), 'g:availability')).toBe(
      'out_of_stock',
    )
  })

  it('shipping with the cost the shop computed; 0 stays, null drops the element', () => {
    const shippingOf = (product: SeoProduct, id: string) =>
      tag(item(buildMerchantFeed([product]), id), 'g:shipping')
    expect(shippingOf(pump(), 'var_pump')).toBe(
      '<g:country>PL</g:country><g:price>12.99 PLN</g:price>',
    )
    expect(shippingOf(wave(), 'var_wave_106_turkus')).toBe(
      '<g:country>PL</g:country><g:price>0.00 PLN</g:price>',
    )
    const none = wave({ variants: [variant({ shippingCost: null })] })
    expect(item(buildMerchantFeed([none]), 'var_wave_106_turkus')).not.toContain('<g:shipping>')
  })

  it('texts are escaped and the description is plain text, at most 5000 characters', () => {
    const odd = wave({
      title: 'Deska & <Wiosło> "Pro"',
      description: `<p>Opis &amp; więcej</p>${'x'.repeat(6000)}`,
    })
    const entry = item(buildMerchantFeed([odd]), 'var_wave_106_turkus')
    expect(tag(entry, 'title')).toBe(
      'Aqua Marina Deska &amp; &lt;Wiosło&gt; &quot;Pro&quot; 10&apos;6&quot; Turkus',
    )
    const description = tag(entry, 'description') ?? ''
    expect(description.startsWith('Opis &amp; więcej')).toBe(true)
    expect(description.replace(/&amp;/g, '&').length).toBeLessThanOrEqual(5000)
  })

  it('the title is cut at 150 characters', () => {
    const long = wave({
      title: 'A'.repeat(200),
      brand: null,
      variants: [variant({ size: null, color: null })],
    })
    expect(tag(item(buildMerchantFeed([long]), 'var_wave_106_turkus'), 'title')).toBe(
      'A'.repeat(150),
    )
  })

  it('control characters from a pasted text are dropped – XML 1.0 does not allow them', () => {
    const odd = wave({
      title: 'Allround\u0000 Wave\u0007',
      description: 'Opis\u001Fdeski\tz\nlinią\u000B',
    })
    const xml = buildMerchantFeed([odd])
    expect([...xml].filter((char) => char < ' ' && !'\t\n\r'.includes(char))).toEqual([])
    const entry = item(xml, 'var_wave_106_turkus')
    expect(tag(entry, 'title')).toBe('Aqua Marina Allround Wave 10&apos;6&quot; Turkus')
    expect(tag(entry, 'description')).toBe('Opisdeski z linią')
  })

  it('no description → subtitle, then title; a variant with no photo at all is left out', () => {
    const bare = wave({
      description: null,
      images: [],
      variants: [variant(), variant({ id: 'var_no_photo', images: [] })],
    })
    const xml = buildMerchantFeed([bare])
    expect(tag(item(xml, 'var_wave_106_turkus'), 'description')).toBe('Zestaw 5w1 z wiosłem')
    expect(xml).not.toContain('var_no_photo')
    const titleOnly = wave({ description: '<p></p>', subtitle: null })
    expect(tag(item(buildMerchantFeed([titleOnly]), 'var_wave_106_turkus'), 'description')).toBe(
      'Allround Wave',
    )
  })

  it('at most 10 additional photos; relative paths become absolute', () => {
    const many = wave({
      variants: [variant({ images: Array.from({ length: 13 }, (_, i) => `/media/p${i}.webp`) })],
    })
    const entry = item(buildMerchantFeed([many]), 'var_wave_106_turkus')
    expect(tag(entry, 'g:image_link')).toBe('https://sklep.pl/media/p0.webp')
    expect(entry.match(/<g:additional_image_link>/g)).toHaveLength(10)
  })
})

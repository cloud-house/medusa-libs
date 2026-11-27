import { describe, expect, it } from 'vitest'
import { categoryCanonical, pagedCanonical } from './canonical'
import { testSeo } from './fixtures'
import { createSeo } from './seo'

const { brandCanonical, productCanonical } = testSeo()

describe('canonical paths', () => {
  it('lists, brands and products point to the bare address', () => {
    expect(categoryCanonical({ root: 'deski-sup', child: 'allround' })).toBe('/deski-sup/allround')
    expect(categoryCanonical({ root: 'zestawy' })).toBe('/zestawy')
    expect(brandCanonical('aqua-marina')).toBe('/marki/aqua-marina')
    expect(productCanonical('wiosło-carbon')).toBe('/produkt/wios%C5%82o-carbon')
  })

  it('guide pages keep their page number', () => {
    expect(pagedCanonical('/poradnik', 1)).toBe('/poradnik')
    expect(pagedCanonical('/poradnik', 2)).toBe('/poradnik?strona=2')
  })

  it('the shop can change the product and brand routes', () => {
    const seo = createSeo({
      siteName: 'S',
      shopTitle: 'S',
      feedDescription: 'S',
      routes: { product: (h) => `/p/${h}`, brand: (h) => `/b/${h}` },
    })
    expect(seo.productCanonical('a')).toBe('/p/a')
    expect(seo.brandCanonical('b')).toBe('/b/b')
  })
})

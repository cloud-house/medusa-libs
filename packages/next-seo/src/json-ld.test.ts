import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { testSeo } from './fixtures'
import { jsonLdHtml } from './json-ld'
import type { SeoProduct, SeoVariant } from './types'

const { articleJsonLd, breadcrumbJsonLd, organizationJsonLd, productJsonLd, websiteJsonLd } =
  testSeo()

const SCHEMA = 'https://schema.org/'
const CTX = { returnDays: 30 }

// biome-ignore lint/suspicious/noExplicitAny: JSON-LD to luźny obiekt – testy czytają pola po ścieżce
type Node = Record<string, any>

const variant = (over: Partial<SeoVariant> = {}): SeoVariant => ({
  id: 'var_1',
  path: '/produkt/allround-wave?kolor=turkus&rozmiar=10-6',
  sku: 'AW-106-T',
  gtin: null,
  size: `10'6"`,
  color: 'Turkus',
  images: ['/media/wave-turkus-0.webp'],
  price: 1899,
  regularPrice: 1899,
  lowestPrice30d: null,
  inStock: true,
  shippingCost: 0,
  ...over,
})

const product = (over: Partial<SeoProduct> = {}): SeoProduct => ({
  id: 'prod_wave',
  handle: 'allround-wave',
  title: 'Allround Wave',
  description: null,
  subtitle: null,
  brand: 'Aqua Marina',
  images: ['/media/wave-0.webp'],
  categoryPath: [],
  googleCategory: null,
  variants: [
    variant(),
    variant({
      id: 'var_2',
      path: '/produkt/allround-wave?kolor=granat&rozmiar=11-6',
      sku: 'AW-116-G',
      size: `11'6"`,
      color: 'Granat',
      images: [],
    }),
  ],
  ...over,
})

const single = (over: Partial<SeoVariant> = {}, product_: Partial<SeoProduct> = {}) =>
  product({
    handle: 'wioslo-carbon-pro',
    title: 'Wiosło Carbon Pro',
    variants: [variant({ size: null, color: null, path: '/produkt/wioslo-carbon-pro', ...over })],
    ...product_,
  })

beforeEach(() => {
  vi.stubEnv('SITE_URL', 'https://sklep.pl')
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('productJsonLd', () => {
  it('a model with variants is a ProductGroup with one Product per variant', () => {
    const node: Node = productJsonLd(product(), CTX)
    expect(node['@context']).toBe('https://schema.org')
    expect(node['@type']).toBe('ProductGroup')
    expect(node.productGroupID).toBe('allround-wave')
    expect(node.variesBy).toEqual([`${SCHEMA}size`, `${SCHEMA}color`])
    expect(node.url).toBe('https://sklep.pl/produkt/allround-wave')
    expect(node.image).toEqual(['https://sklep.pl/media/wave-0.webp'])
    expect(node.hasVariant).toHaveLength(2)
  })

  it('variant: name, attributes, its own address and an offer with the current price', () => {
    const [first, second] = productJsonLd(product(), CTX).hasVariant as Node[]
    expect(first).toEqual(
      expect.objectContaining({
        '@type': 'Product',
        name: `Allround Wave 10'6" Turkus`,
        sku: 'AW-106-T',
        size: `10'6"`,
        color: 'Turkus',
        brand: { '@type': 'Brand', name: 'Aqua Marina' },
        url: 'https://sklep.pl/produkt/allround-wave?kolor=turkus&rozmiar=10-6',
        image: ['https://sklep.pl/media/wave-turkus-0.webp'],
      }),
    )
    expect(first?.offers).toEqual(
      expect.objectContaining({
        '@type': 'Offer',
        url: first?.url,
        price: 1899,
        priceCurrency: 'PLN',
        availability: `${SCHEMA}InStock`,
        itemCondition: `${SCHEMA}NewCondition`,
      }),
    )
    // Wariant bez własnych zdjęć – zdjęcia produktu.
    expect(second?.image).toEqual(['https://sklep.pl/media/wave-0.webp'])
  })

  it('variesBy lists only the attributes some variant has', () => {
    const node: Node = productJsonLd(
      product({ variants: [variant({ color: null }), variant({ id: 'v2', color: null })] }),
      CTX,
    )
    expect(node.variesBy).toEqual([`${SCHEMA}size`])
  })

  it('strikethrough price only when the 30-day low is above the current price', () => {
    const discounted: Node = productJsonLd(single({ price: 1699, lowestPrice30d: 1999 }), CTX)
    expect(discounted.offers.priceSpecification).toEqual({
      '@type': 'UnitPriceSpecification',
      priceType: `${SCHEMA}StrikethroughPrice`,
      price: 1999,
      priceCurrency: 'PLN',
    })
    for (const lowestPrice30d of [1699, 1500, null]) {
      const node: Node = productJsonLd(single({ price: 1699, lowestPrice30d }), CTX)
      expect(node.offers).not.toHaveProperty('priceSpecification')
    }
  })

  it('out of stock → OutOfStock', () => {
    const node: Node = productJsonLd(single({ inStock: false }), CTX)
    expect(node.offers.availability).toBe(`${SCHEMA}OutOfStock`)
  })

  it('return policy: finite window from the argument, by mail, the buyer pays the return', () => {
    const node: Node = productJsonLd(single(), { returnDays: 14 })
    expect(node.offers.hasMerchantReturnPolicy).toEqual({
      '@type': 'MerchantReturnPolicy',
      applicableCountry: 'PL',
      returnPolicyCategory: `${SCHEMA}MerchantReturnFiniteReturnWindow`,
      merchantReturnDays: 14,
      returnMethod: `${SCHEMA}ReturnByMail`,
      returnFees: `${SCHEMA}ReturnFeesCustomerResponsibility`,
    })
  })

  it('shipping details with the cost the shop computed – 0 stays 0, null drops the key', () => {
    const paid: Node = productJsonLd(single({ shippingCost: 17.99 }), CTX)
    expect(paid.offers.shippingDetails).toEqual({
      '@type': 'OfferShippingDetails',
      shippingRate: { '@type': 'MonetaryAmount', value: 17.99, currency: 'PLN' },
      shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'PL' },
      deliveryTime: {
        '@type': 'ShippingDeliveryTime',
        handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
        transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 2, unitCode: 'DAY' },
      },
    })
    const free: Node = productJsonLd(single({ shippingCost: 0 }), CTX)
    expect(free.offers.shippingDetails.shippingRate.value).toBe(0)
    const none: Node = productJsonLd(single({ shippingCost: null }), CTX)
    expect(none.offers).not.toHaveProperty('shippingDetails')
  })

  it('a 13-digit GTIN goes into gtin13, another length into gtin', () => {
    const ean: Node = productJsonLd(single({ gtin: '5901234123457' }), CTX)
    expect(ean.gtin13).toBe('5901234123457')
    expect(ean).not.toHaveProperty('gtin')
    const upc: Node = productJsonLd(single({ gtin: '012345678905' }), CTX)
    expect(upc.gtin).toBe('012345678905')
    expect(upc).not.toHaveProperty('gtin13')
  })

  it('a single variant is a Product at the canonical address; no photos and no brand → no keys', () => {
    const node: Node = productJsonLd(single({ images: [] }, { images: [], brand: null }), CTX)
    expect(node['@type']).toBe('Product')
    expect(node.name).toBe('Wiosło Carbon Pro')
    expect(node.url).toBe('https://sklep.pl/produkt/wioslo-carbon-pro')
    expect(node.offers.url).toBe('https://sklep.pl/produkt/wioslo-carbon-pro')
    expect(node).not.toHaveProperty('image')
    expect(node).not.toHaveProperty('brand')
    expect(node).not.toHaveProperty('gtin13')
    expect(JSON.stringify(node)).not.toContain('null')
  })

  it('a brand of only spaces is no brand', () => {
    const node: Node = productJsonLd(single({}, { brand: '   ' }), CTX)
    expect(node).not.toHaveProperty('brand')
  })

  it('the description is plain text; empty → subtitle; neither → no key', () => {
    const html: Node = productJsonLd(
      product({ description: '<p>Deska <strong>allround</strong> &amp; touring</p>' }),
      CTX,
    )
    expect(html.description).toBe('Deska allround & touring')
    expect(html.hasVariant[0].description).toBe('Deska allround & touring')
    const empty: Node = productJsonLd(product({ description: '<p> </p>', subtitle: 'Zestaw' }), CTX)
    expect(empty.description).toBe('Zestaw')
    const none: Node = productJsonLd(product({ description: ' ', subtitle: null }), CTX)
    expect(none).not.toHaveProperty('description')
  })
})

describe('breadcrumbJsonLd', () => {
  it('positions 1…n with absolute addresses, the current page last', () => {
    expect(
      breadcrumbJsonLd([{ label: 'Strona główna', href: '/' }, { label: 'Bez linku' }], {
        label: 'Allround',
        href: '/deski-sup/allround',
      }),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Strona główna', item: 'https://sklep.pl/' },
        { '@type': 'ListItem', position: 2, name: 'Bez linku' },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'Allround',
          item: 'https://sklep.pl/deski-sup/allround',
        },
      ],
    })
  })
})

const ARTICLE = {
  title: 'Ile PSI?',
  path: '/poradnik/ile-psi',
  description: 'Dlaczego 15 PSI to nie zawsze najlepszy wybór.',
  image: '/api/media/file/psi.jpg',
  publishedAt: '2026-10-07T08:00:00.000Z',
  updatedAt: '2026-10-09T12:00:00.000Z',
}

describe('articleJsonLd', () => {
  it('BlogPosting with dates, an absolute image and the shop as author and publisher', () => {
    expect(articleJsonLd(ARTICLE)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: 'Ile PSI?',
      description: 'Dlaczego 15 PSI to nie zawsze najlepszy wybór.',
      image: ['https://sklep.pl/api/media/file/psi.jpg'],
      datePublished: '2026-10-07T08:00:00.000Z',
      dateModified: '2026-10-09T12:00:00.000Z',
      url: 'https://sklep.pl/poradnik/ile-psi',
      author: { '@type': 'Organization', name: 'Sklep Testowy', url: 'https://sklep.pl/' },
      publisher: { '@type': 'Organization', name: 'Sklep Testowy', url: 'https://sklep.pl/' },
    })
  })

  it('no photo, blank description, not updated → no image and description, modified = published', () => {
    const node: Node = articleJsonLd({
      ...ARTICLE,
      image: null,
      description: '  ',
      updatedAt: null,
    })
    expect(node).not.toHaveProperty('image')
    expect(node).not.toHaveProperty('description')
    expect(node.dateModified).toBe('2026-10-07T08:00:00.000Z')
  })

  it('an article without dates has no date keys', () => {
    const node: Node = articleJsonLd({ ...ARTICLE, publishedAt: null, updatedAt: null })
    expect(node).not.toHaveProperty('datePublished')
    expect(node).not.toHaveProperty('dateModified')
  })
})

const NO_ORG = { legalName: null, email: null, phone: null, sameAs: [], address: null }

describe('organizationJsonLd', () => {
  it('without contact, profiles and address → name, address of the shop and logo only', () => {
    expect(organizationJsonLd(NO_ORG)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Sklep Testowy',
      url: 'https://sklep.pl/',
      logo: 'https://sklep.pl/logo.png',
    })
  })

  it('contact, profiles and the seller address when they are filled in', () => {
    expect(
      organizationJsonLd({
        legalName: 'Sklep sp. z o.o.',
        email: 'sklep@sklep.pl',
        phone: '+48 600 100 200',
        sameAs: ['https://instagram.com/sklep'],
        address: { street: 'ul. Jeziorna 1', postalCode: '11-500', city: 'Giżycko' },
      }),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Sklep Testowy',
      url: 'https://sklep.pl/',
      logo: 'https://sklep.pl/logo.png',
      legalName: 'Sklep sp. z o.o.',
      email: 'sklep@sklep.pl',
      telephone: '+48 600 100 200',
      sameAs: ['https://instagram.com/sklep'],
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'ul. Jeziorna 1',
        postalCode: '11-500',
        addressLocality: 'Giżycko',
        addressCountry: 'PL',
      },
    })
  })

  it('blank texts are missing keys; a street without a city is no address', () => {
    const node: Node = organizationJsonLd({
      ...NO_ORG,
      email: '  ',
      phone: '',
      sameAs: [' '],
      address: { street: 'X', postalCode: null, city: null },
    })
    expect(node).not.toHaveProperty('email')
    expect(node).not.toHaveProperty('telephone')
    expect(node).not.toHaveProperty('sameAs')
    expect(node).not.toHaveProperty('address')
  })
})

describe('websiteJsonLd', () => {
  it('name and address of the shop, no search action', () => {
    expect(websiteJsonLd()).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Sklep Testowy',
      url: 'https://sklep.pl/',
    })
  })
})

describe('jsonLdHtml', () => {
  it('a closing tag in shop text cannot end the script element', () => {
    const html = jsonLdHtml({ name: '</script><b>A & B</b>' })
    expect(html).not.toContain('<')
    expect(JSON.parse(html)).toEqual({ name: '</script><b>A & B</b>' })
    expect(jsonLdHtml([{ a: 1 }, { b: 2 }])).toBe('[{"a":1},{"b":2}]')
  })
})

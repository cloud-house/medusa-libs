import { describe, expect, it } from 'vitest'
import {
  DEFAULT_REVALIDATION_EVENTS,
  defaultTagsForEvent,
  postRevalidate,
  REVALIDATE_TIMEOUT_MS,
} from './revalidation'

const lookup = {
  productHandle: async (id: string) =>
    ({ prod_1: 'allround-wave', prod_pl: 'wiosło-karbonowe' })[id] ?? null,
  categoryHandle: async (id: string) => ({ pcat_1: 'allround', pcat_raw: 'Deski SUP' })[id] ?? null,
}
const tags = (name: string, data: Record<string, unknown>) =>
  defaultTagsForEvent(name, data, lookup)

describe('DEFAULT_REVALIDATION_EVENTS', () => {
  it('lists Medusa and brand events, no shop-specific ones', () => {
    expect(REVALIDATE_TIMEOUT_MS).toBe(10_000)
    expect(DEFAULT_REVALIDATION_EVENTS).toEqual(
      expect.arrayContaining([
        'product.updated',
        'pricing.price.deleted',
        'promotion.campaign.updated',
        'brand.created',
        'brand.updated',
        'brand.deleted',
        'product-brand.updated',
      ]),
    )
    expect(DEFAULT_REVALIDATION_EVENTS.every((e) => !e.includes('price-history'))).toBe(true)
  })
})

describe('defaultTagsForEvent', () => {
  it('maps product events to catalog and product tags', async () => {
    expect(await tags('product.updated', { id: 'prod_1' })).toEqual([
      'catalog',
      'product:allround-wave',
    ])
    expect(await tags('product.deleted', { id: 'prod_x' })).toEqual(['catalog', 'cms'])
  })

  it('encodes handles outside ASCII', async () => {
    expect(await tags('product.updated', { id: 'prod_pl' })).toEqual([
      'catalog',
      'product:wios%C5%82o-karbonowe',
    ])
    expect(await tags('product-category.created', { id: 'pcat_raw' })).toEqual([
      'catalog',
      'category:Deski%20SUP',
    ])
  })

  it('maps category events', async () => {
    expect(await tags('product-category.updated', { id: 'pcat_1' })).toEqual([
      'catalog',
      'category:allround',
    ])
  })

  it('maps brand events with the previous handle', async () => {
    expect(
      await tags('brand.updated', { id: 'b1', handle: 'gladiator', previous_handle: 'gladiatr' }),
    ).toEqual(['catalog', 'brand:gladiator', 'brand:gladiatr'])
    expect(await tags('brand.created', { id: 'b1', handle: 'gladiator' })).toEqual([
      'catalog',
      'brand:gladiator',
    ])
    expect(await tags('brand.deleted', { id: 'b1' })).toEqual(['catalog'])
  })

  it('maps product-brand assignment to the product, and ignores no change', async () => {
    expect(
      await tags('product-brand.updated', {
        product_id: 'prod_1',
        brand_id: 'b2',
        previous_brand_id: 'b1',
      }),
    ).toEqual(['catalog', 'product:allround-wave'])
    expect(
      await tags('product-brand.updated', {
        product_id: 'prod_1',
        brand_id: 'b1',
        previous_brand_id: 'b1',
      }),
    ).toEqual([])
  })

  it('maps price, stock and variant events to the catalog tag', async () => {
    for (const name of [
      'pricing.price-list.updated',
      'inventory-level.updated',
      'product-variant.updated',
    ]) {
      expect(await tags(name, { id: 'x', variant_ids: ['v1'] })).toEqual(['catalog'])
    }
  })

  it('maps every Promotion module event to the promotions tag', async () => {
    for (const name of [
      'promotion.promotion.updated',
      'promotion.application-method.created',
      'promotion.promotion-rule.deleted',
      'promotion.campaign.updated',
    ]) {
      expect(await tags(name, { id: 'promo_1' })).toEqual(['promotions'])
    }
  })

  it('returns null for an unknown event', async () => {
    expect(await tags('shop.custom.changed', {})).toBeNull()
  })
})

describe('postRevalidate', () => {
  const capture = (status = 200) => {
    const calls: { url: string; init: RequestInit }[] = []
    const fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return new Response('{}', { status })
    }) as unknown as typeof globalThis.fetch
    const warnings: string[] = []
    return { calls, fetch, warnings, logger: { warn: (m: string) => warnings.push(m) } }
  }

  it('posts tags with the secret and never throws', async () => {
    const { calls, fetch, logger, warnings } = capture()
    expect(
      await postRevalidate(['catalog'], {
        url: 'http://shop.test//',
        secret: 's3cret',
        fetch,
        logger,
      }),
    ).toBe(true)
    expect(calls[0]?.url).toBe('http://shop.test/api/revalidate')
    expect(new Headers(calls[0]?.init.headers).get('x-revalidate-secret')).toBe('s3cret')
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ tags: ['catalog'] })

    const failing = (async () => {
      throw new Error('ECONNREFUSED')
    }) as unknown as typeof fetch
    const rejected = capture(401)
    expect(
      await postRevalidate(['catalog'], {
        url: 'http://shop.test',
        secret: 's',
        fetch: failing,
        logger,
      }),
    ).toBe(false)
    expect(
      await postRevalidate(['catalog'], { url: 'http://shop.test', secret: 's', ...rejected }),
    ).toBe(false)
    expect(warnings).toHaveLength(1)
    expect(rejected.warnings).toHaveLength(1)
    expect(
      await postRevalidate([], { url: 'http://shop.test', secret: 's', fetch: failing, logger }),
    ).toBe(true)
  })

  it('uses a custom header, prefix and tag predicate', async () => {
    const { calls, fetch, logger, warnings } = capture()
    await postRevalidate(['catalog', 'nope'], {
      url: 'http://shop.test',
      secret: 's',
      header: 'x-shop-secret',
      isAllowedTag: (t) => t === 'catalog',
      logPrefix: 'Shop',
      fetch,
      logger,
    })
    expect(new Headers(calls[0]?.init.headers).get('x-shop-secret')).toBe('s')
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ tags: ['catalog'] })
    expect(warnings[0]).toMatch(/^Shop: /)
    expect(warnings[0]).toContain('nope')
  })

  it('drops tags the storefront would reject and sends the rest', async () => {
    const { calls, fetch, warnings, logger } = capture()
    const tooLong = `product:${'a'.repeat(300)}`
    await postRevalidate(['catalog', tooLong], {
      url: 'http://shop.test',
      secret: 's',
      fetch,
      logger,
    })
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ tags: ['catalog'] })
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain(tooLong)
  })

  it('gives up on a hanging storefront instead of waiting for the default timeout', async () => {
    const { calls, fetch, logger } = capture()
    await postRevalidate(['catalog'], { url: 'http://shop.test', secret: 's', fetch, logger })
    expect(calls[0]?.init.signal).toBeInstanceOf(AbortSignal)
  })
})

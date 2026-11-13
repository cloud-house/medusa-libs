import type { SubscriberArgs } from '@medusajs/framework'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRevalidationSubscriber } from './subscriber'

const warnings: string[] = []
const logger = { warn: (m: string) => warnings.push(m) }
const product = {
  listProducts: async () => [{ handle: 'deska' }],
  listProductCategories: async () => [{ handle: 'sup' }],
}
const args = (name: string, data: Record<string, unknown> = {}) =>
  ({
    event: { name, data },
    container: { resolve: (key: string) => (key === 'logger' ? logger : product) },
  }) as unknown as SubscriberArgs<Record<string, unknown>>

const make = (extra = {}) =>
  createRevalidationSubscriber({
    events: ['product.updated'],
    tagsForEvent: async (_n, data, lookup) => {
      const handle = await lookup.productHandle(String(data.id))
      return handle ? ['catalog', `product:${handle}`] : ['catalog']
    },
    logPrefix: 'Shop',
    ...extra,
  })

describe('createRevalidationSubscriber', () => {
  const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
  beforeEach(() => {
    warnings.length = 0
    fetchMock.mockClear()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('STOREFRONT_URL', '')
    vi.stubEnv('REVALIDATE_SECRET', '')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('exposes the events as config', () => {
    expect(make().config).toEqual({ event: ['product.updated'] })
  })

  it('warns once and sends nothing without URL or secret', async () => {
    const { handler } = make()
    await handler(args('product.updated', { id: 'p1' }))
    await handler(args('product.updated', { id: 'p1' }))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatch(/^Shop: /)
    expect(warnings[0]).toContain('STOREFRONT_URL')
    expect(warnings[0]).toContain('REVALIDATE_SECRET')
  })

  it('posts the tags built with the product lookup', async () => {
    vi.stubEnv('STOREFRONT_URL', 'http://shop.test')
    vi.stubEnv('REVALIDATE_SECRET', 'sec')
    await make().handler(args('product.updated', { id: 'p1' }))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://shop.test/api/revalidate')
    expect(JSON.parse(String(init.body))).toEqual({ tags: ['catalog', 'product:deska'] })
  })

  it('reads custom env names and swallows tag errors', async () => {
    vi.stubEnv('MY_URL', 'http://shop.test')
    vi.stubEnv('MY_SECRET', 'sec')
    const sub = make({
      urlEnv: 'MY_URL',
      secretEnv: 'MY_SECRET',
      tagsForEvent: async () => {
        throw new Error('boom')
      },
    })
    await expect(sub.handler(args('product.updated'))).resolves.toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(warnings[0]).toContain('boom')
  })

  it('logs in English by default and in Polish with locale pl, as the Polish shop did before the kit', async () => {
    await make({ logPrefix: 'Acme' }).handler(args('product.updated'))
    await make({ logPrefix: 'Acme', locale: 'pl' }).handler(args('product.updated'))
    expect(warnings).toEqual([
      'Acme: STOREFRONT_URL or REVALIDATE_SECRET is not set – the storefront refreshes Medusa data only when its cache expires.',
      'Acme: brak STOREFRONT_URL lub REVALIDATE_SECRET – sklep odświeży dane Medusy dopiero po 5 minutach.',
    ])

    vi.stubEnv('STOREFRONT_URL', 'http://shop.test')
    vi.stubEnv('REVALIDATE_SECRET', 'sec')
    warnings.length = 0
    const boom = async () => {
      throw new Error('boom')
    }
    await make({ logPrefix: 'Acme', locale: 'pl', tagsForEvent: boom }).handler(
      args('product.updated'),
    )
    await make({ logPrefix: 'Acme', tagsForEvent: boom }).handler(args('product.updated'))
    expect(warnings).toEqual([
      'Acme: nie udało się ustalić tagów rewalidacji dla product.updated: Error: boom',
      'Acme: could not work out revalidation tags for product.updated: Error: boom',
    ])
  })

  it('passes locale and message overrides on to the POST log', async () => {
    vi.stubEnv('STOREFRONT_URL', 'http://shop.test')
    vi.stubEnv('REVALIDATE_SECRET', 'sec')
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 403 }))
    await make({ locale: 'pl', messages: { failed: undefined } }).handler(
      args('product.updated', { id: 'p1' }),
    )
    expect(warnings).toEqual([
      'Shop: rewalidacja sklepu odrzucona (403) dla catalog, product:deska.',
    ])
    warnings.length = 0
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 403 }))
    await make({ messages: { rejected: (s: number) => `nope ${s}` } }).handler(
      args('product.updated', { id: 'p1' }),
    )
    expect(warnings).toEqual(['Shop: nope 403'])
  })
})

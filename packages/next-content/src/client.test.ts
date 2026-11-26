import { describe, expect, it } from 'vitest'
import { type ContentFetchInit, createContentClient } from './client'

type Call = { path: string; init: ContentFetchInit }

function setup(
  options: Parameters<typeof createContentClient>[0] extends infer O ? Partial<O> : never = {},
  response: unknown = {},
) {
  const calls: Call[] = []
  const client = createContentClient({
    fetch: (async (path: string, init: ContentFetchInit) => {
      calls.push({ path, init })
      return response
    }) as never,
    ...options,
  })
  return { client, calls }
}

describe('content client', () => {
  it('published mode: force-cache with tags, revalidate and the version header', async () => {
    const { client, calls } = setup({ viewVersion: 5, versionHeader: 'x-shop-version' })
    await client.layout({ tags: ['cms'] })
    const { init } = calls[0] as Call
    expect(init).toMatchObject({
      cache: 'force-cache',
      next: { tags: ['cms'], revalidate: 3600 },
      headers: { 'x-shop-version': '5' },
    })
  })

  it('revalidate is configurable', async () => {
    const { client, calls } = setup({ revalidate: 60 })
    await client.layout({ tags: ['cms'] })
    expect((calls[0] as Call).init).toMatchObject({ next: { revalidate: 60 } })
  })

  it('preview mode: no-store, no tags, draft=1 and the preview header', async () => {
    const { client, calls } = setup({ viewVersion: 5, versionHeader: 'x-shop-version' })
    await client.layout({ previewToken: 'tok' })
    const { init } = calls[0] as Call
    expect(init.cache).toBe('no-store')
    expect(init).not.toHaveProperty('next')
    expect(init.query).toEqual({ draft: '1' })
    expect(init.headers).toEqual({ 'x-shop-version': '5', 'x-preview-token': 'tok' })
  })

  it('previewHeader is configurable and defaults to x-preview-token', async () => {
    const custom = setup({ previewHeader: 'x-my-token' })
    await custom.client.layout({ previewToken: 'tok' })
    expect((custom.calls[0] as Call).init.headers).toMatchObject({ 'x-my-token': 'tok' })
    const plain = setup()
    await plain.client.layout({ previewToken: 'tok' })
    expect((plain.calls[0] as Call).init.headers).toMatchObject({ 'x-preview-token': 'tok' })
  })

  it('no version header without versionHeader and viewVersion', async () => {
    const { client, calls } = setup()
    await client.layout({ tags: ['cms'] })
    expect((calls[0] as Call).init.headers).toEqual({})
  })

  it('path segments are URL-encoded', async () => {
    const { client, calls } = setup({}, { page: null, content: null })
    await client.page('o nas/ą?', { tags: [] })
    await client.catalog('product', 'a/b c', { tags: [] })
    await client.article('x#y', { tags: [] })
    await client.articleCategory('a b', { tags: [] })
    expect(calls.map((c) => c.path)).toEqual([
      '/store/content/pages/o%20nas%2F%C4%85%3F',
      '/store/content/catalog/product/a%2Fb%20c',
      '/store/content/articles/x%23y',
      '/store/content/article-categories/a%20b',
    ])
  })

  it('unwraps the response keys and returns null for a missing document', async () => {
    expect(await setup({}, { page: null }).client.page('x', { tags: [] })).toBeNull()
    expect(
      await setup({}, { content: undefined }).client.catalog('brand', 'x', { tags: [] }),
    ).toBeNull()
    expect(await setup({}, { handle: 'new' }).client.moved('brand', 'old', { tags: [] })).toBe(
      'new',
    )
    expect(await setup({}, { home: { blocks: [] } }).client.home({ tags: [] })).toEqual({
      blocks: [],
    })
  })

  it('moved sends kind and handle as query', async () => {
    const { client, calls } = setup({}, { handle: null })
    await client.moved('brand', 'x', { tags: ['cms'] })
    const call = calls[0] as Call
    expect(call.path).toBe('/store/content/moved')
    expect(call.init.query).toEqual({ kind: 'brand', handle: 'x' })
  })

  it('articleList omits the category when null and always sends the page', async () => {
    const { client, calls } = setup({}, { articles: [] })
    await client.articleList({ category: null, page: 2 }, { tags: [] })
    await client.articleList({ category: 'sup', page: 1 }, { tags: [] })
    expect((calls[0] as Call).init.query).toEqual({ page: '2' })
    expect((calls[1] as Call).init.query).toEqual({ category: 'sup', page: '1' })
  })

  it('preview keeps the query next to draft=1', async () => {
    const { client, calls } = setup({}, { articles: [] })
    await client.articleSummaries({ latest: '3' }, { previewToken: 't' })
    expect((calls[0] as Call).init.query).toEqual({ latest: '3', draft: '1' })
  })

  it('kind() returns the raw response of a shop-defined route', async () => {
    const { client, calls } = setup({}, { quiz: { title: 'Q' } })
    const out = await client.kind<{ quiz: { title: string } }>('/store/content/quiz', {
      tags: ['cms'],
    })
    expect(out).toEqual({ quiz: { title: 'Q' } })
    expect((calls[0] as Call).path).toBe('/store/content/quiz')
  })

  it('reads the list endpoints', async () => {
    const { client, calls } = setup(
      {},
      { slugs: [], infoNav: [], categories: [], pages: [], articles: [], articleCategories: [] },
    )
    await client.pageIndex({ tags: [] })
    await client.articleCategories({ tags: [] })
    await client.sitemap({ tags: [] })
    expect(calls.map((c) => c.path)).toEqual([
      '/store/content/pages',
      '/store/content/article-categories',
      '/store/content/sitemap',
    ])
  })
})

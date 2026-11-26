import type {
  ArticleCategory,
  ArticleDoc,
  ArticleListPage,
  ArticleSummary,
  InfoNavItem,
  LayoutData,
  PageDoc,
} from '@cloud-house/commerce-rules'

export type ContentFetchInit =
  | {
      query?: Record<string, string>
      headers: Record<string, string>
      cache: 'force-cache'
      next: { tags: string[]; revalidate: number }
    }
  | { query?: Record<string, string>; headers: Record<string, string>; cache: 'no-store' }

/** The part of `@medusajs/js-sdk` `client` used here – injected so the logic is testable. */
export interface ContentFetchClient {
  fetch<T>(path: string, init: ContentFetchInit): Promise<T>
}

/** How a read is made: cached with tags, or – in preview – the working copy without cache. */
export type ReadMode = { tags: string[] } | { previewToken: string }

export type DatedSlug = { slug: string; updatedAt: string }

export interface ContentClientOptions {
  /** `(path, init) => sdk.client.fetch(path, init)` of the shop's Medusa SDK. */
  fetch: ContentFetchClient['fetch']
  /**
   * Version of the view shapes the Next data cache keeps. Sent in `versionHeader`, which the
   * backend ignores: the `fetch` cache key includes headers, so bumping it drops old entries.
   */
  viewVersion?: number
  versionHeader?: string
  /** Seconds a published read is cached; edits purge the tags earlier. Default 3600. */
  revalidate?: number
  /** Header with the panel's preview token. Default `x-preview-token`. */
  previewHeader?: string
}

const segment = (value: string) => encodeURIComponent(value)

export function createContentClient(options: ContentClientOptions) {
  const {
    viewVersion,
    versionHeader,
    revalidate = 3600,
    previewHeader = 'x-preview-token',
  } = options
  const versionHeaders: Record<string, string> =
    versionHeader && viewVersion !== undefined ? { [versionHeader]: String(viewVersion) } : {}

  const init = (mode: ReadMode, query?: Record<string, string>): ContentFetchInit => {
    if ('previewToken' in mode) {
      return {
        query: { ...query, draft: '1' },
        headers: { ...versionHeaders, [previewHeader]: mode.previewToken },
        cache: 'no-store',
      }
    }
    return {
      ...(query ? { query } : {}),
      headers: { ...versionHeaders },
      cache: 'force-cache',
      next: { tags: mode.tags, revalidate },
    }
  }

  const get = <T>(path: string, mode: ReadMode, query?: Record<string, string>) =>
    options.fetch<T>(path, init(mode, query))

  return {
    /** Content of a catalog entity; `null` for an unknown handle. */
    async catalog<T>(type: 'product' | 'category' | 'brand', handle: string, mode: ReadMode) {
      const { content } = await get<{ content: T | null | undefined }>(
        `/store/content/catalog/${type}/${segment(handle)}`,
        mode,
      )
      return content ?? null
    },
    async page(slug: string, mode: ReadMode) {
      const { page } = await get<{ page: PageDoc | null }>(
        `/store/content/pages/${segment(slug)}`,
        mode,
      )
      return page
    },
    pageIndex: (mode: ReadMode) =>
      get<{ slugs: string[]; infoNav: InfoNavItem[] }>('/store/content/pages', mode),
    async article(slug: string, mode: ReadMode) {
      const { article } = await get<{ article: ArticleDoc | null }>(
        `/store/content/articles/${segment(slug)}`,
        mode,
      )
      return article
    },
    articleList: (query: { category: string | null; page: number }, mode: ReadMode) =>
      get<ArticleListPage>('/store/content/articles', mode, {
        ...(query.category ? { category: query.category } : {}),
        page: String(query.page),
      }),
    async articleSummaries(query: Record<string, string>, mode: ReadMode) {
      const { articles } = await get<{ articles: ArticleSummary[] }>(
        '/store/content/articles',
        mode,
        query,
      )
      return articles
    },
    async articleCategories(mode: ReadMode) {
      const { categories } = await get<{ categories: ArticleCategory[] }>(
        '/store/content/article-categories',
        mode,
      )
      return categories
    },
    async articleCategory(slug: string, mode: ReadMode) {
      const { category } = await get<{ category: ArticleCategory | null }>(
        `/store/content/article-categories/${segment(slug)}`,
        mode,
      )
      return category
    },
    async home<H>(mode: ReadMode) {
      const { home } = await get<{ home: H | null }>('/store/content/home', mode)
      return home
    },
    async layout(mode: ReadMode) {
      const { layout } = await get<{ layout: LayoutData }>('/store/content/layout', mode)
      return layout
    },
    /** Current handle of an entity that once had `handle`; `null` when none. */
    async moved(kind: 'product' | 'category' | 'brand', handle: string, mode: ReadMode) {
      const { handle: current } = await get<{ handle: string | null }>(
        '/store/content/moved',
        mode,
        { kind, handle },
      )
      return current
    },
    sitemap: (mode: ReadMode) =>
      get<{
        pages: DatedSlug[]
        articles: DatedSlug[]
        articleCategories: DatedSlug[]
      }>('/store/content/sitemap', mode),
    /** Any other route of the shop's own content kinds (e.g. the quiz); raw response. */
    kind: <T>(path: string, mode: ReadMode, query?: Record<string, string>) =>
      get<T>(path, mode, query),
  }
}

export type ContentClient = ReturnType<typeof createContentClient>

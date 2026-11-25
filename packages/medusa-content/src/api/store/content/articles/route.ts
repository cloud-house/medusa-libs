import { ARTICLES_PER_PAGE, pickRelated } from '@cloud-house/commerce-rules'
import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { articleSummary, viewContext } from '../../../../kinds/views'
import { findEntities } from '../../../../lib/entities'
import { byNewest, lookupsFor, readable } from '../../../../lib/store-views'
import { CONTENT_MODULE } from '../../../../modules/content'
import type ContentModuleService from '../../../../modules/content/service'

const param = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null)

/**
 * Article tiles, newest first:
 * - `?category=&page=` – the Poradnik list (the newest one is featured on page 1 of „all”),
 * - `?latest=N` – the home page block,
 * - `?product=handle&limit=` – „Z Poradnika” on a product page (articles with the product in a block),
 * - `?related=slug&category=` – „Czytaj także”: same category first, then the newest.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const articles = (await readable(req.scope, 'article')).sort(byNewest)
  const categories = await readable(req.scope, 'article_category')
  const categoryId = (slug: string | null) =>
    slug ? (categories.find(({ data }) => data.slug === slug)?.row.id ?? null) : null
  const summaries = async (items: typeof articles) => {
    const lookups = await lookupsFor(req.scope, items)
    return items.map((item) => articleSummary(item, viewContext(req.scope, false, lookups)))
  }

  const latest = Number(param(req.query.latest))
  if (latest > 0)
    return void res.json({ articles: await summaries(articles.slice(0, Math.min(latest, 12))) })

  const product = param(req.query.product)
  if (product) {
    const limit = Math.min(Number(param(req.query.limit)) || 3, 12)
    const content: ContentModuleService = req.scope.resolve(CONTENT_MODULE)
    const [found] = await findEntities(req.scope, 'product', 'handle', [product])
    const productId = found?.id
    if (!productId) return void res.json({ articles: [] })
    const refs = await content.listContentRefs(
      { target_type: 'product', target_id: productId, state: 'published' },
      { select: ['entry_id'], take: null },
    )
    const ids = new Set(refs.map((ref) => ref.entry_id))
    return void res.json({
      articles: await summaries(articles.filter(({ row }) => ids.has(row.id)).slice(0, limit)),
    })
  }

  const related = param(req.query.related)
  if (related) {
    const others = articles.filter(({ data }) => data.slug !== related)
    const own = categoryId(param(req.query.category))
    const same = own ? others.filter(({ data }) => data.category === own).slice(0, 3) : []
    const lookups = await lookupsFor(req.scope, [...same, ...others.slice(0, 6)])
    const ctx = viewContext(req.scope, false, lookups)
    return void res.json({
      articles: pickRelated(
        related,
        same.map((item) => articleSummary(item, ctx)),
        others.slice(0, 6).map((item) => articleSummary(item, ctx)),
      ),
    })
  }

  const page = Math.max(1, Number(param(req.query.page)) || 1)
  const category = param(req.query.category)
  let pool = articles
  let featured: (typeof articles)[number] | undefined
  if (category === null) {
    featured = articles[0]
    pool = articles.slice(1)
  } else {
    const own = categoryId(category)
    if (!own) return void res.json({ featured: null, items: [], page, totalPages: 1 })
    pool = articles.filter(({ data }) => data.category === own)
  }
  const items = pool.slice((page - 1) * ARTICLES_PER_PAGE, page * ARTICLES_PER_PAGE)
  const lookups = await lookupsFor(req.scope, featured ? [featured, ...items] : items)
  const ctx = viewContext(req.scope, false, lookups)
  res.json({
    featured: featured && page === 1 ? articleSummary(featured, ctx) : null,
    items: items.map((item) => articleSummary(item, ctx)),
    page,
    totalPages: Math.max(1, Math.ceil(pool.length / ARTICLES_PER_PAGE)),
  })
}

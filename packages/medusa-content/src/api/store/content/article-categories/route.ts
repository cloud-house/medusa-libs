import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { viewOf } from '../../../../kinds/views'
import { lookupsFor, readable } from '../../../../lib/store-views'

/** Poradnik pills: categories with at least one published article, by `order`, then name. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const [articles, categories] = await Promise.all([
    readable(req.scope, 'article'),
    readable(req.scope, 'article_category'),
  ])
  const used = new Set(articles.map(({ data }) => data.category))
  const shown = categories
    .filter(({ row }) => used.has(row.id))
    .sort(
      (a, b) =>
        Number(a.data.order ?? 100) - Number(b.data.order ?? 100) ||
        String(a.data.name).localeCompare(String(b.data.name), 'pl'),
    )
  const lookups = await lookupsFor(req.scope, shown)
  res.json({ categories: shown.map((item) => viewOf(req.scope, item, false, lookups)) })
}

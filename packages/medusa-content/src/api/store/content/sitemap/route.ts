import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { modifiedAt, readable } from '../../../../lib/store-views'

/** Addresses with their last change for the sitemap: published pages and articles, all categories. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const [pages, articles, categories] = await Promise.all(
    (['page', 'article', 'article_category'] as const).map((type) => readable(req.scope, type)),
  )
  const dated = (items: Awaited<ReturnType<typeof readable>>) =>
    items.map(({ row, data }) => ({
      slug: String(data.slug),
      updatedAt: modifiedAt(row),
    }))
  res.json({ pages: dated(pages), articles: dated(articles), articleCategories: dated(categories) })
}

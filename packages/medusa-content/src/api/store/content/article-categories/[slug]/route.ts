import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { viewOf } from '../../../../../kinds/views'
import { bySlug, lookupsFor } from '../../../../../lib/store-views'

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const item = await bySlug(req.scope, 'article_category', req.params.slug as string, false)
  res.json({
    category: item ? viewOf(req.scope, item, false, await lookupsFor(req.scope, [item])) : null,
  })
}

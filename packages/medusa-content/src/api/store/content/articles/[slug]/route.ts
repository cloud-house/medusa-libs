import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { viewOf } from '../../../../../kinds/views'
import { draftRequested } from '../../../../../lib/preview'
import { bySlug, lookupsFor } from '../../../../../lib/store-views'

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const draft = await draftRequested(req)
  const item = await bySlug(req.scope, 'article', req.params.slug as string, draft)
  if (!item) return void res.json({ article: null })
  res.json({ article: viewOf(req.scope, item, draft, await lookupsFor(req.scope, [item], draft)) })
}

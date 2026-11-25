import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { viewOf } from '../../../../../kinds/views'
import { draftRequested } from '../../../../../lib/preview'
import { bySlug, lookupsFor } from '../../../../../lib/store-views'

/** An info page (`?draft=1` – the working copy, preview token required); `page: null` if none. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const draft = await draftRequested(req)
  const item = await bySlug(req.scope, 'page', req.params.slug as string, draft)
  if (!item) return void res.json({ page: null })
  res.json({ page: viewOf(req.scope, item, draft, await lookupsFor(req.scope, [item], draft)) })
}

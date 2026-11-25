import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { viewOf } from '../../../../kinds/views'
import { contentOptions } from '../../../../lib/plugin-options'
import { draftRequested } from '../../../../lib/preview'
import { lookupsFor, readPublished } from '../../../../lib/store-views'

/**
 * Home page blocks; `home: null` before the first publication – the shop shows its default layout
 * (or the `defaults` of the kind, if it has any).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const draft = await draftRequested(req)
  const kind = contentOptions(req.scope).registry.get('global', 'home-page')
  const item = await readPublished(req.scope, 'global', 'home-page', { draft })
  if (!item) return void res.json({ home: kind?.defaults ?? null })
  const view = viewOf(req.scope, item, draft, await lookupsFor(req.scope, [item], draft))
  const home = kind?.enrich ? await kind.enrich(view, { container: req.scope }) : view
  res.json({ home })
}

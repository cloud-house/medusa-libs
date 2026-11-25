import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { CONTENT_MODULE } from '../../../../modules/content'
import type ContentModuleService from '../../../../modules/content/service'
import { ENTITY_KINDS, type EntityKind } from '../../../../types'

/**
 * Current handle of a renamed product, category or brand (`?kind=&handle=` – the old one); the
 * newest rename wins, and only while the document still exists. `handle: null` – not moved.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const kind = String(req.query.kind ?? '')
  const old = String(req.query.handle ?? '')
  if (!(ENTITY_KINDS as readonly string[]).includes(kind) || !old) {
    return void res.json({ handle: null })
  }
  const content: ContentModuleService = req.scope.resolve(CONTENT_MODULE)
  const [redirect] = await content.listHandleRedirects(
    { kind: kind as EntityKind, old_handle: old },
    { order: { created_at: 'DESC' }, take: 1 },
  )
  if (!redirect) return void res.json({ handle: null })
  const [current] = await content.listCatalogHandles(
    { kind: redirect.kind, entity_id: redirect.entity_id },
    { take: 1 },
  )
  res.json({ handle: current && current.handle !== old ? current.handle : null })
}

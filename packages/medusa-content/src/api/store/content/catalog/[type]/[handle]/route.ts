import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { MedusaError } from '@medusajs/framework/utils'
import { populated, viewContext } from '../../../../../../kinds/views'
import { contentOptions } from '../../../../../../lib/plugin-options'
import { draftRequested } from '../../../../../../lib/preview'
import { lookupsFor, readEntity } from '../../../../../../lib/store-views'
import type { EntryRow } from '../../../../../../types'

/**
 * Content of a product, category or brand page by its Medusa handle, for every kind bound to a
 * record. A record without saved content gets the empty content; an unknown one – `null`.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const type = req.params.type as string
  const { registry } = contentOptions(req.scope)
  const kind = registry.entityKinds().find((candidate) => candidate.type === type)
  if (!kind) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Nieznany typ treści: ${type}.`)
  }
  const draft = await draftRequested(req)
  const found = await readEntity(req.scope, kind.entity, req.params.handle as string, { draft })
  if (!found) return void res.json({ content: null })
  const row = found.row ?? ({ type, slug: null, entity_id: found.entity.id } as EntryRow)
  const item = { row, data: found.data }
  const lookups = await lookupsFor(req.scope, [item], draft)
  const ctx = viewContext(req.scope, draft, lookups, found.entity)
  res.json({
    content: kind.view ? kind.view(item, ctx) : { ...populated(item, ctx), ...found.entity },
  })
}

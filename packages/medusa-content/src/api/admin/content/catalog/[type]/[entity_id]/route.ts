import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { MedusaError } from '@medusajs/framework/utils'
import { actorId, adminEntry } from '../../../../../../lib/admin-view'
import { contentOptions } from '../../../../../../lib/plugin-options'
import { CONTENT_MODULE } from '../../../../../../modules/content'
import type ContentModuleService from '../../../../../../modules/content/service'
import type { EntryRow } from '../../../../../../modules/content/service'
import { saveContentWorkflow } from '../../../../../../workflows/save-content'
import type { AdminSaveContentType } from '../../../validators'

const typeOf = (req: AuthenticatedMedusaRequest) => {
  const type = req.params.type as string
  const bound = contentOptions(req.scope)
    .registry.entityKinds()
    .some((kind) => kind.type === type)
  if (!bound) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Nieznany typ treści katalogu: ${type}.`)
  }
  return type
}

/** Content of a product, category or brand; `entry: null` until the editor saves it once. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const content: ContentModuleService = req.scope.resolve(CONTENT_MODULE)
  const [entry] = (await content.listContentEntries(
    { type: typeOf(req), entity_id: req.params.entity_id as string },
    { take: 1 },
  )) as unknown as EntryRow[]
  res.json(entry ? await adminEntry(req.scope, entry) : { entry: null, related: {} })
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminSaveContentType>,
  res: MedusaResponse,
) {
  const { data, expected_updated_at } = req.validatedBody
  const { result } = await saveContentWorkflow(req.scope).run({
    input: {
      target: { type: typeOf(req), entity_id: req.params.entity_id as string },
      mode: 'publish',
      data,
      expected_updated_at,
      user_id: actorId(req),
    },
  })
  res.json(await adminEntry(req.scope, result))
}

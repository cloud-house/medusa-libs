import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { MedusaError } from '@medusajs/framework/utils'
import { actorId, adminEntry } from '../../../../../lib/admin-view'
import { contentOptions } from '../../../../../lib/plugin-options'
import { CONTENT_MODULE } from '../../../../../modules/content'
import type ContentModuleService from '../../../../../modules/content/service'
import type { EntryRow } from '../../../../../modules/content/service'
import { saveContentWorkflow } from '../../../../../workflows/save-content'
import type { AdminSaveContentType } from '../../validators'

const keyOf = (req: AuthenticatedMedusaRequest) => {
  const key = req.params.key as string
  if (!contentOptions(req.scope).registry.isGlobalKey(key))
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Nieznany element układu: ${key}.`)
  return key
}

/** A global; `entry: null` before the first save – the panel starts from the shop's defaults. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const content: ContentModuleService = req.scope.resolve(CONTENT_MODULE)
  const [entry] = (await content.listContentEntries(
    { type: 'global', slug: keyOf(req) },
    { take: 1 },
  )) as unknown as EntryRow[]
  const initial = contentOptions(req.scope).registry.get('global', keyOf(req))?.initial ?? null
  res.json(entry ? await adminEntry(req.scope, entry) : { entry: null, related: {}, initial })
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminSaveContentType>,
  res: MedusaResponse,
) {
  const { mode, data, expected_updated_at } = req.validatedBody
  const { result } = await saveContentWorkflow(req.scope).run({
    input: {
      target: { type: 'global', key: keyOf(req) },
      mode,
      data,
      expected_updated_at,
      user_id: actorId(req),
    },
  })
  res.json(await adminEntry(req.scope, result))
}

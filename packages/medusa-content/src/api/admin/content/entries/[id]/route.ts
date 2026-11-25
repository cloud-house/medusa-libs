import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { actorId, adminEntry } from '../../../../../lib/admin-view'
import { CONTENT_MODULE } from '../../../../../modules/content'
import type ContentModuleService from '../../../../../modules/content/service'
import type { EntryRow } from '../../../../../modules/content/service'
import { deleteContentWorkflow } from '../../../../../workflows/entry-actions'
import { saveContentWorkflow } from '../../../../../workflows/save-content'
import type { AdminSaveContentType } from '../../validators'

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const content: ContentModuleService = req.scope.resolve(CONTENT_MODULE)
  const entry = (await content.retrieveContentEntry(req.params.id as string)) as unknown as EntryRow
  res.json(await adminEntry(req.scope, entry))
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminSaveContentType>,
  res: MedusaResponse,
) {
  const { mode, data, expected_updated_at } = req.validatedBody
  const { result } = await saveContentWorkflow(req.scope).run({
    input: {
      target: { id: req.params.id as string },
      mode,
      data,
      expected_updated_at,
      user_id: actorId(req),
    },
  })
  res.json(await adminEntry(req.scope, result))
}

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { result } = await deleteContentWorkflow(req.scope).run({
    input: { id: req.params.id as string },
  })
  res.json({ id: result.id, object: 'content_entry', deleted: true })
}

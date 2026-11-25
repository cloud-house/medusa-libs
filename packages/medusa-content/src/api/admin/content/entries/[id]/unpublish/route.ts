import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { actorId, adminEntry } from '../../../../../../lib/admin-view'
import { unpublishContentWorkflow } from '../../../../../../workflows/entry-actions'
import type { AdminUnpublishContentType } from '../../../validators'

export async function POST(
  req: AuthenticatedMedusaRequest<AdminUnpublishContentType>,
  res: MedusaResponse,
) {
  const { result } = await unpublishContentWorkflow(req.scope).run({
    input: {
      id: req.params.id as string,
      expected_updated_at: req.validatedBody.expected_updated_at,
      user_id: actorId(req),
    },
  })
  res.json(await adminEntry(req.scope, result))
}

import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { actorId, adminEntry } from '../../../../../../lib/admin-view'
import { restoreContentVersionWorkflow } from '../../../../../../workflows/entry-actions'

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { result } = await restoreContentVersionWorkflow(req.scope).run({
    input: { version_id: req.params.id as string, user_id: actorId(req) },
  })
  res.json(await adminEntry(req.scope, result))
}

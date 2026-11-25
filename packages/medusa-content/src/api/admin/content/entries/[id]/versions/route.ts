import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { MedusaError } from '@medusajs/framework/utils'
import { CONTENT_MODULE } from '../../../../../../modules/content'
import type ContentModuleService from '../../../../../../modules/content/service'

/**
 * History of an entry, newest first. `?at=2026-11-01T12:00:00Z` – only the version published at
 * that moment (which Regulamin applied on a given day).
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const content: ContentModuleService = req.scope.resolve(CONTENT_MODULE)
  const id = req.params.id as string
  if (req.query.at) {
    const at = new Date(String(req.query.at))
    if (Number.isNaN(at.getTime()))
      throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Błędna data.')
    const version = await content.publishedVersionAt(id, at)
    res.json({ versions: version ? [version] : [] })
    return
  }
  res.json({ versions: await content.listVersions(id) })
}

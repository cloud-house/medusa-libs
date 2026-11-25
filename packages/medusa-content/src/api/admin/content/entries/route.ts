import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { MedusaError } from '@medusajs/framework/utils'
import { actorId, adminEntry, entryTitle } from '../../../../lib/admin-view'
import { contentOptions } from '../../../../lib/plugin-options'
import { CONTENT_MODULE } from '../../../../modules/content'
import type ContentModuleService from '../../../../modules/content/service'
import type { EntryRow } from '../../../../modules/content/service'
import { GLOBAL_TYPE } from '../../../../types'
import { saveContentWorkflow } from '../../../../workflows/save-content'
import type { AdminCreateContentType } from '../validators'

/** Pages, articles or article categories for the panel's lists (a few hundred at most). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const type = String(req.query.type ?? '')
  const listed = contentOptions(req.scope)
    .registry.kinds()
    .filter((kind) => kind.type !== GLOBAL_TYPE && !kind.entity)
    .map((kind) => kind.type)
  if (!listed.includes(type)) {
    const names =
      listed.length > 1
        ? `${listed.slice(0, -1).join(', ')} albo ${listed.at(-1)}`
        : (listed[0] ?? '')
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `Podaj typ: ${names}.`)
  }
  const content: ContentModuleService = req.scope.resolve(CONTENT_MODULE)
  const rows = (await content.listContentEntries(
    { type },
    { order: { updated_at: 'DESC' }, take: null },
  )) as unknown as EntryRow[]
  res.json({
    entries: rows.map((row) => {
      const source = row.draft ?? row.data ?? {}
      return {
        id: row.id,
        type: row.type,
        slug: row.slug,
        title: entryTitle(row),
        status: row.status,
        has_draft: row.draft !== null,
        legal_review: source.legalReview === true,
        category: typeof source.category === 'string' ? source.category : null,
        order: typeof source.order === 'number' ? source.order : null,
        published_at: row.published_at,
        updated_at: row.updated_at,
      }
    }),
  })
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminCreateContentType>,
  res: MedusaResponse,
) {
  const { type, mode, data } = req.validatedBody
  const { result } = await saveContentWorkflow(req.scope).run({
    input: { target: { type }, mode, data, user_id: actorId(req) },
  })
  res.status(201).json(await adminEntry(req.scope, result))
}

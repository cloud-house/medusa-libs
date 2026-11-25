import { validateHttpUrl } from '@cloud-house/commerce-rules'
import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { Modules } from '@medusajs/framework/utils'
import { notAllowed } from '../../../../../lib/api-errors'
import { CONTENT_MODULE } from '../../../../../modules/content'
import type ContentModuleService from '../../../../../modules/content/service'
import { ContentEvents } from '../../../../../workflows/events'
import { deleteMediaWorkflow } from '../../../../../workflows/media'
import type { AdminUpdateMediaType } from '../../validators'

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const content: ContentModuleService = req.scope.resolve(CONTENT_MODULE)
  const id = req.params.id as string
  const [media, used_in] = await Promise.all([
    content.retrieveMediaAsset(id),
    content.entriesUsing({ target_type: 'media', target_id: id }),
  ])
  res.json({ media, used_in })
}

/** Alt text and credit; the shop's cache of every page with this file is purged. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminUpdateMediaType>,
  res: MedusaResponse,
) {
  const { alt, credit, credit_url } = req.validatedBody
  const url = validateHttpUrl(credit_url)
  if (url !== true) throw notAllowed(url)
  const content: ContentModuleService = req.scope.resolve(CONTENT_MODULE)
  const media = await content.updateMediaAssets({
    id: req.params.id as string,
    ...(alt !== undefined ? { alt: alt.trim() } : {}),
    ...(credit !== undefined ? { credit: credit?.trim() || null } : {}),
    ...(credit_url !== undefined ? { credit_url: credit_url?.trim() || null } : {}),
  })
  await req.scope.resolve(Modules.EVENT_BUS).emit({
    name: ContentEvents.CHANGED,
    data: { id: media.id, type: 'media', slug: null, published: true },
  })
  res.json({ media })
}

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { result } = await deleteMediaWorkflow(req.scope).run({ input: req.params.id as string })
  res.json({ id: result.id, object: 'media_asset', deleted: true })
}

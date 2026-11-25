import { PREVIEW_TOKEN_TTL_SECONDS, signPreviewToken } from '@cloud-house/commerce-rules'
import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { MedusaError } from '@medusajs/framework/utils'
import { actorId } from '../../../../lib/admin-view'
import { contentOptions } from '../../../../lib/plugin-options'
import { CONTENT_MODULE } from '../../../../modules/content'
import type ContentModuleService from '../../../../modules/content/service'
import type { EntryRow } from '../../../../modules/content/service'
import type { AdminContentPreviewType } from '../validators'

const COLLECTION = { page: 'pages', article: 'articles', home: 'home-page' } as const

/**
 * Signed link to the shop's preview of a working copy (2 h). Signing out of the panel does not
 * revoke a link already opened – the expiry bounds it.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminContentPreviewType>,
  res: MedusaResponse,
) {
  const { previewSecret: secret, previewPath } = contentOptions(req.scope)
  const storefront = process.env.STOREFRONT_URL
  if (!secret || !storefront) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'Podgląd nie jest skonfigurowany (CONTENT_PREVIEW_SECRET, STOREFRONT_URL).',
    )
  }
  const { target, id } = req.validatedBody
  let slug: string | null = null
  if (target !== 'home') {
    if (!id) throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Brak treści do podglądu.')
    const content: ContentModuleService = req.scope.resolve(CONTENT_MODULE)
    const row = (await content.retrieveContentEntry(id)) as unknown as EntryRow
    const source = row.draft ?? row.data
    slug = typeof source?.slug === 'string' ? source.slug : row.slug
  }
  const token = await signPreviewToken(
    {
      sub: actorId(req) ?? 'admin',
      exp: Math.floor(Date.now() / 1000) + PREVIEW_TOKEN_TTL_SECONDS,
    },
    secret,
  )
  const url = new URL(previewPath, storefront)
  url.searchParams.set('token', token)
  url.searchParams.set('collection', COLLECTION[target])
  if (slug) url.searchParams.set('slug', slug)
  res.json({ url: url.toString(), expires_in: PREVIEW_TOKEN_TTL_SECONDS })
}

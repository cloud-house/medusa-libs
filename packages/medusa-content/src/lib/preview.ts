import { verifyPreviewToken } from '@cloud-house/commerce-rules'
import type { MedusaRequest } from '@medusajs/framework/http'
import { MedusaError } from '@medusajs/framework/utils'
import { contentOptions } from './plugin-options'

export const PREVIEW_EXPIRED_MESSAGE = 'Podgląd wygasł – otwórz go ponownie z panelu.'

/**
 * `?draft=1` – the working copy, only with a valid preview token from the panel (the store never
 * shows drafts to anyone else). Returns whether this read is a draft read. The header and the
 * secret come from the plugin options.
 */
export async function draftRequested(req: MedusaRequest): Promise<boolean> {
  if (req.query.draft !== '1' && req.query.draft !== 'true') return false
  const { previewHeader, previewSecret } = contentOptions(req.scope)
  const header = req.headers[previewHeader]
  const token = Array.isArray(header) ? header[0] : header
  const claims = await verifyPreviewToken(token, previewSecret)
  if (!claims) throw new MedusaError(MedusaError.Types.UNAUTHORIZED, PREVIEW_EXPIRED_MESSAGE)
  return true
}

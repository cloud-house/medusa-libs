import { verifyPreviewToken } from '@cloud-house/commerce-rules'
import { cookies, draftMode } from 'next/headers.js'
import { cache } from 'react'
import type { ReadMode } from './client'

export interface PreviewSessionOptions {
  /** Cookie holding the panel's signed preview token (set by the enter route). */
  cookieName: string
  /** Env variable with the signing secret shared with the panel. Default `CONTENT_PREVIEW_SECRET`. */
  secretEnv?: string
}

/**
 * Preview of one request: Next draft mode is on and the cookie holds a valid, unexpired token
 * signed by the panel. Signing out of the panel does not revoke it – the expiry does.
 */
export function createPreviewSession({
  cookieName,
  secretEnv = 'CONTENT_PREVIEW_SECRET',
}: PreviewSessionOptions) {
  const previewToken = cache(async (): Promise<string | null> => {
    if (!(await draftMode()).isEnabled) return null
    const token = (await cookies()).get(cookieName)?.value ?? null
    return (await verifyPreviewToken(token, process.env[secretEnv])) ? token : null
  })

  const isPreview = cache(async (): Promise<boolean> => (await previewToken()) !== null)

  /**
   * Read mode of a request: the working copy with the token when the editor previews (`draft`
   * and a valid token), otherwise the cached published state with these tags.
   */
  async function readMode(tags: string[], draft = false): Promise<ReadMode> {
    const token = draft ? await previewToken() : null
    return token ? { previewToken: token } : { tags }
  }

  return { cookieName, previewToken, isPreview, readMode }
}

export type PreviewSession = ReturnType<typeof createPreviewSession>

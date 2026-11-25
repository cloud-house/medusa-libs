import { signPreviewToken } from '@cloud-house/commerce-rules'
import type { MedusaRequest } from '@medusajs/framework/http'
import { z } from '@medusajs/framework/zod'
import { resolveOptions } from '../../options'
import { draftRequested, PREVIEW_EXPIRED_MESSAGE } from '../preview'

const options = resolveOptions({
  kinds: [{ type: 'faq', label: 'FAQ', schema: z.object({}) }],
  previewSecret: 'secret',
  previewHeader: 'x-preview-token',
})

const request = (query: Record<string, string>, headers: Record<string, string> = {}) =>
  ({
    query,
    headers,
    scope: { resolve: () => ({ getOptions: () => options }) },
  }) as unknown as MedusaRequest

describe('draftRequested', () => {
  it('is false without ?draft=1, whatever the headers', async () => {
    expect(await draftRequested(request({}))).toBe(false)
    expect(await draftRequested(request({ draft: '0' }, { 'x-preview-token': 'junk' }))).toBe(false)
  })

  it('refuses ?draft=1 without a valid token (Review Focus 7)', async () => {
    await expect(draftRequested(request({ draft: '1' }))).rejects.toThrow(PREVIEW_EXPIRED_MESSAGE)
    await expect(
      draftRequested(request({ draft: '1' }, { 'x-preview-token': 'a.b' })),
    ).rejects.toThrow(PREVIEW_EXPIRED_MESSAGE)
    const expired = await signPreviewToken({ sub: 'user_1', exp: 1 }, 'secret')
    await expect(
      draftRequested(request({ draft: 'true' }, { 'x-preview-token': expired })),
    ).rejects.toThrow(PREVIEW_EXPIRED_MESSAGE)
    const otherSecret = await signPreviewToken({ sub: 'u', exp: 9_999_999_999 }, 'other')
    await expect(
      draftRequested(request({ draft: '1' }, { 'x-preview-token': otherSecret })),
    ).rejects.toThrow(PREVIEW_EXPIRED_MESSAGE)
  })

  it('accepts a valid token from the configured header', async () => {
    const token = await signPreviewToken({ sub: 'user_1', exp: 9_999_999_999 }, 'secret')
    expect(await draftRequested(request({ draft: '1' }, { 'x-preview-token': token }))).toBe(true)
    // the old shop header is not the configured one
    await expect(
      draftRequested(request({ draft: '1' }, { 'x-chonasupa-preview': token })),
    ).rejects.toThrow(PREVIEW_EXPIRED_MESSAGE)
  })
})

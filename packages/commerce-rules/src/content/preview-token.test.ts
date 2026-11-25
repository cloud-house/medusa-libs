import { describe, expect, it } from 'vitest'
import { signPreviewToken, verifyPreviewToken } from './preview-token'

describe('token podglądu', () => {
  const exp = Math.floor(Date.now() / 1000) + 60

  it('przyjmuje podpisany token i odrzuca podrobiony, przeterminowany albo z innym sekretem', async () => {
    const token = await signPreviewToken({ sub: 'user_1', exp }, 'sekret')
    expect(await verifyPreviewToken(token, 'sekret')).toEqual({ sub: 'user_1', exp })
    expect(await verifyPreviewToken(token, 'inny')).toBeNull()
    expect(await verifyPreviewToken(`${token}x`, 'sekret')).toBeNull()
    expect(await verifyPreviewToken(token, 'sekret', (exp + 1) * 1000)).toBeNull()
    const [, signature] = token.split('.')
    const forged = `${btoa(JSON.stringify({ sub: 'user_2', exp })).replace(/=+$/, '')}.${signature}`
    expect(await verifyPreviewToken(forged, 'sekret')).toBeNull()
    expect(await verifyPreviewToken(null, 'sekret')).toBeNull()
    expect(await verifyPreviewToken(token, '')).toBeNull()
  })
})

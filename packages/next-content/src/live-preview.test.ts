import { describe, expect, it } from 'vitest'
import { isPreviewRefreshMessage } from './live-preview-message'

const message = (origin: string, data: unknown) => ({ origin, data })

describe('isPreviewRefreshMessage', () => {
  const admin = 'https://admin.shop.test'

  it('accepts the panel message of the right type', () => {
    expect(
      isPreviewRefreshMessage(message(admin, { type: 'content:preview-refresh' }), admin),
    ).toBe(true)
  })

  it('rejects another origin when the admin origin is set', () => {
    expect(
      isPreviewRefreshMessage(
        message('https://evil.test', { type: 'content:preview-refresh' }),
        admin,
      ),
    ).toBe(false)
  })

  it('without an admin origin any origin is accepted (local development)', () => {
    expect(
      isPreviewRefreshMessage(
        message('http://localhost:9000', { type: 'content:preview-refresh' }),
        undefined,
      ),
    ).toBe(true)
  })

  it('rejects a wrong type, null and non-object data', () => {
    expect(isPreviewRefreshMessage(message(admin, { type: 'other' }), admin)).toBe(false)
    expect(isPreviewRefreshMessage(message(admin, null), admin)).toBe(false)
    expect(isPreviewRefreshMessage(message(admin, 'content:preview-refresh'), admin)).toBe(false)
  })

  it('the message type is configurable', () => {
    expect(isPreviewRefreshMessage(message(admin, { type: 'x:refresh' }), admin, 'x:refresh')).toBe(
      true,
    )
  })
})

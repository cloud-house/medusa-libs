import { signPreviewToken } from '@cloud-house/commerce-rules'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ draft: false, cookie: undefined as string | undefined }))

vi.mock('next/headers.js', () => ({
  draftMode: async () => ({ isEnabled: state.draft }),
  cookies: async () => ({
    get: (name: string) =>
      name === 'shop_preview' && state.cookie ? { value: state.cookie } : undefined,
  }),
}))

const SECRET = 'test-preview-secret'
process.env.CONTENT_PREVIEW_SECRET = SECRET
const { createPreviewSession } = await import('./preview-session')
const session = createPreviewSession({ cookieName: 'shop_preview' })
const token = (exp: number, secret = SECRET) => signPreviewToken({ sub: 'user_1', exp }, secret)
const inAnHour = () => Math.floor(Date.now() / 1000) + 3600

describe('preview session', () => {
  beforeEach(() => {
    state.draft = false
    state.cookie = undefined
  })

  it('is off without draft mode, even with a valid token', async () => {
    state.cookie = await token(inAnHour())
    expect(await session.isPreview()).toBe(false)
    expect(await session.previewToken()).toBeNull()
  })

  it('is on with draft mode and a valid token', async () => {
    state.draft = true
    state.cookie = await token(inAnHour())
    expect(await session.previewToken()).toBe(state.cookie)
    expect(await session.isPreview()).toBe(true)
  })

  it('is off for an expired token, another secret, or no cookie', async () => {
    state.draft = true
    state.cookie = await token(Math.floor(Date.now() / 1000) - 1)
    expect(await session.isPreview()).toBe(false)
    state.cookie = await token(inAnHour(), 'other')
    expect(await session.isPreview()).toBe(false)
    state.cookie = undefined
    expect(await session.isPreview()).toBe(false)
  })

  it('reads the secret from the configured env variable', async () => {
    process.env.MY_PREVIEW_SECRET = 'mine'
    const custom = createPreviewSession({
      cookieName: 'shop_preview',
      secretEnv: 'MY_PREVIEW_SECRET',
    })
    state.draft = true
    state.cookie = await token(inAnHour(), 'mine')
    expect(await custom.isPreview()).toBe(true)
    expect(await session.isPreview()).toBe(false)
  })

  it('readMode: published tags unless draft is requested and the token is valid', async () => {
    state.draft = true
    state.cookie = await token(inAnHour())
    expect(await session.readMode(['cms'])).toEqual({ tags: ['cms'] })
    expect(await session.readMode(['cms'], true)).toEqual({ previewToken: state.cookie })
    state.cookie = undefined
    expect(await session.readMode(['cms'], true)).toEqual({ tags: ['cms'] })
  })

  it('exposes the cookie name', () => {
    expect(session.cookieName).toBe('shop_preview')
  })
})

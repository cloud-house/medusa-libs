import { signPreviewToken } from '@cloud-house/commerce-rules'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  enabled: false,
  disabled: false,
  set: [] as { name: string; value: string; options: Record<string, unknown> }[],
  deleted: [] as string[],
}))

vi.mock('next/headers.js', () => ({
  draftMode: async () => ({
    enable: () => {
      state.enabled = true
    },
    disable: () => {
      state.disabled = true
    },
  }),
  cookies: async () => ({
    set: (name: string, value: string, options: Record<string, unknown>) =>
      state.set.push({ name, value, options }),
    delete: (name: string) => state.deleted.push(name),
  }),
}))

const SECRET = 'test-preview-secret'
process.env.CONTENT_PREVIEW_SECRET = SECRET
const { createPreviewRoutes } = await import('./preview-routes')
const routes = createPreviewRoutes({ cookieName: 'shop_preview' })
const exp = () => Math.floor(Date.now() / 1000) + 3600
const url = (params: Record<string, string>) =>
  new Request(`https://shop.test/api/preview?${new URLSearchParams(params)}`)

beforeEach(() => {
  state.enabled = false
  state.disabled = false
  state.set = []
  state.deleted = []
})

describe('enter route', () => {
  it('401 without a token, nothing enabled', async () => {
    const res = await routes.enter.GET(url({ slug: 'regulamin' }))
    expect(res.status).toBe(401)
    expect(state.enabled).toBe(false)
    expect(state.set).toEqual([])
  })

  it('401 for a token signed with another secret', async () => {
    const token = await signPreviewToken({ sub: 'u', exp: exp() }, 'other')
    const res = await routes.enter.GET(url({ token, slug: 'regulamin' }))
    expect(res.status).toBe(401)
    expect(state.enabled).toBe(false)
  })

  it('400 for an invalid slug or collection, nothing enabled', async () => {
    const token = await signPreviewToken({ sub: 'u', exp: exp() }, SECRET)
    const res = await routes.enter.GET(url({ token, slug: '../x', collection: 'nope' }))
    expect(res.status).toBe(400)
    expect(state.enabled).toBe(false)
    expect(state.set).toEqual([])
  })

  it('valid token: enables draft mode, sets an httpOnly cookie that expires with the token, redirects', async () => {
    const e = exp()
    const token = await signPreviewToken({ sub: 'u', exp: e }, SECRET)
    const res = await routes.enter.GET(url({ token, slug: 'regulamin' }))
    expect(res.status).toBe(307)
    expect(new URL(res.headers.get('location') as string).pathname).toBe('/regulamin')
    expect(state.enabled).toBe(true)
    expect(state.set).toHaveLength(1)
    expect(state.set[0]).toMatchObject({
      name: 'shop_preview',
      value: token,
      options: { httpOnly: true, sameSite: 'lax', path: '/' },
    })
    expect(((state.set[0]?.options ?? {}).expires as Date).getTime()).toBe(e * 1000)
  })

  it('custom messages replace the defaults', async () => {
    const custom = createPreviewRoutes({
      cookieName: 'x',
      messages: { expired: 'expired!', invalidTarget: 'bad target!' },
    })
    expect(await (await custom.enter.GET(url({}))).text()).toBe('expired!')
    const token = await signPreviewToken({ sub: 'u', exp: exp() }, SECRET)
    expect(await (await custom.enter.GET(url({ token, slug: '../x' }))).text()).toBe('bad target!')
  })
})

describe('exit route', () => {
  const post = (body?: Record<string, string>) => {
    const form = new FormData()
    for (const [k, v] of Object.entries(body ?? {})) form.set(k, v)
    return new Request('https://shop.test/api/preview/exit', {
      method: 'POST',
      ...(body ? { body: form } : {}),
    })
  }

  it('disables draft mode, deletes the cookie, 303 to the page', async () => {
    const res = await routes.exit.POST(post({ slug: 'regulamin' }))
    expect(state.disabled).toBe(true)
    expect(state.deleted).toEqual(['shop_preview'])
    expect(res.status).toBe(303)
    expect(new URL(res.headers.get('location') as string).pathname).toBe('/regulamin')
  })

  it('without a form body or with a bad collection goes to /', async () => {
    const none = await routes.exit.POST(post())
    expect(none.status).toBe(303)
    expect(new URL(none.headers.get('location') as string).pathname).toBe('/')
    const bad = await routes.exit.POST(post({ slug: 'x', collection: 'nope' }))
    expect(new URL(bad.headers.get('location') as string).pathname).toBe('/')
  })
})

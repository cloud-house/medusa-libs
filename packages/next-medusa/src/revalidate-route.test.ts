import { revalidateTag } from 'next/cache'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRevalidateRoute } from './revalidate-route'

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))

const SECRET = 'test-revalidate-secret'

function request(body: unknown, secret: string | null = SECRET, header = 'x-revalidate-secret') {
  return new Request('http://localhost:3000/api/revalidate', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(secret === null ? {} : { [header]: secret }),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('createRevalidateRoute', () => {
  const { POST } = createRevalidateRoute()

  beforeEach(() => {
    vi.stubEnv('REVALIDATE_SECRET', SECRET)
    vi.mocked(revalidateTag).mockReset()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('401 without a secret and with a wrong one (also of another length)', async () => {
    for (const secret of [null, 'zly-sekret-tej-samej-dlug', 'x']) {
      const response = await POST(request({ tags: ['catalog'] }, secret))
      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: 'Nieprawidłowy sekret.' })
    }
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('401 and a log line when the shop has no secret configured', async () => {
    vi.stubEnv('REVALIDATE_SECRET', '')
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await POST(request({ tags: ['catalog'] }, ''))).status).toBe(401)
    expect(log).toHaveBeenCalledWith(
      '[next-medusa] Brak REVALIDATE_SECRET – webhook rewalidacji jest wyłączony.',
    )
    log.mockRestore()
  })

  it('401 when the env var is unset altogether', async () => {
    delete process.env.REVALIDATE_SECRET
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await POST(request({ tags: ['catalog'] }))).status).toBe(401)
  })

  it('400 for a bad body, empty list, over 100 tags, a disallowed or too long tag', async () => {
    const tooMany = Array.from({ length: 101 }, (_, i) => `product:p${i}`)
    for (const body of [
      'nie-json',
      {},
      { tags: 'catalog' },
      { tags: [] },
      { tags: tooMany },
      { tags: ['product:../x'] },
      { tags: [`product:${'a'.repeat(300)}`] },
      { tags: ['nieznany'] },
      { tags: [1] },
    ]) {
      const response = await POST(request(body))
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: 'Podaj od 1 do 100 dozwolonych tagów w polu „tags”.',
      })
    }
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('200 and the list of purged tags', async () => {
    const response = await POST(request({ tags: ['catalog', 'product:allround-wave'] }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ revalidated: ['catalog', 'product:allround-wave'] })
    expect(revalidateTag).toHaveBeenCalledWith('product:allround-wave', { expire: 0 })
  })

  it('honours secretEnv, header, isAllowedTag, logPrefix and locale', async () => {
    vi.stubEnv('MY_SECRET', 's3')
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const route = createRevalidateRoute({
      secretEnv: 'MY_SECRET',
      header: 'x-my-secret',
      isAllowedTag: (tag) => tag === 'only',
      logPrefix: 'Shop',
      locale: 'en',
    })
    expect((await route.POST(request({ tags: ['only'] }, 's3', 'x-my-secret'))).status).toBe(200)
    const bad = await route.POST(request({ tags: ['catalog'] }, 's3', 'x-my-secret'))
    expect(bad.status).toBe(400)
    expect(await bad.json()).toEqual({
      error: 'Provide 1 to 100 allowed tags in the "tags" field.',
    })
    const denied = await route.POST(request({ tags: ['only'] }, 'nope', 'x-my-secret'))
    expect(await denied.json()).toEqual({ error: 'Invalid secret.' })
    vi.stubEnv('MY_SECRET', '')
    await route.POST(request({ tags: ['only'] }, 's3', 'x-my-secret'))
    expect(log).toHaveBeenCalledWith(
      '[Shop] MY_SECRET is not set – the revalidation webhook is disabled.',
    )
    log.mockRestore()
  })

  it('ignores undefined message overrides', async () => {
    const route = createRevalidateRoute({
      messages: { unauthorized: undefined, invalidTags: () => 'custom' },
    })
    const denied = await route.POST(request({ tags: ['catalog'] }, 'x'))
    expect(await denied.json()).toEqual({ error: 'Nieprawidłowy sekret.' })
    const bad = await route.POST(request({ tags: [] }))
    expect(await bad.json()).toEqual({ error: 'custom' })
  })
})

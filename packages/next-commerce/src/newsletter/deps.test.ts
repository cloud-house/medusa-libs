import { describe, expect, it, vi } from 'vitest'
import { createNewsletterDeps } from './deps'
import { fakeNewsletterProvider } from './provider'

describe('createNewsletterDeps', () => {
  const setup = (over: Partial<Parameters<typeof createNewsletterDeps>[0]> = {}) => {
    const calls: { path: string; init: Record<string, unknown> }[] = []
    const fetch = vi.fn(async (path: string, init: Record<string, unknown>) => {
      calls.push({ path, init })
      return { exists: true }
    })
    const deps = createNewsletterDeps({
      fetch: fetch as never,
      secretHeader: 'x-shop-secret',
      secret: 's3cret',
      provider: null,
      allow: () => true,
      consentText: 'Zgoda',
      ...over,
    })
    return { deps, calls }
  }

  it('asks and writes through the newsletter route with the shop secret header, without cache', async () => {
    const { deps, calls } = setup()
    expect(await deps.exists('a@b.pl')).toBe(true)
    await deps.create({ email: 'a@b.pl', consentText: 'Zgoda', consentAt: 'T', source: 'home' })
    expect(calls).toEqual([
      {
        path: '/store/newsletter-subscribers',
        init: {
          query: { email: 'a@b.pl' },
          headers: { 'x-shop-secret': 's3cret' },
          cache: 'no-store',
        },
      },
      {
        path: '/store/newsletter-subscribers',
        init: {
          method: 'POST',
          headers: { 'x-shop-secret': 's3cret' },
          body: { email: 'a@b.pl', consent_text: 'Zgoda', consent_at: 'T', source: 'home' },
          cache: 'no-store',
        },
      },
    ])
    expect(deps.consentText).toBe('Zgoda')
  })

  it('a provider failure is logged with the prefix and without the address', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const provider = { add: vi.fn(async () => Promise.reject(new Error('boom for a@b.pl'))) }
    const { deps } = setup({ provider, logPrefix: '[Shop]' })
    await deps.notify('a@b.pl')
    expect(error).toHaveBeenCalledWith(
      '[Shop] Zapis na newsletter u dostawcy nie powiódł się: Error: boom for [e-mail]',
    )
    error.mockRestore()
  })

  it('without a provider notify does nothing; the default prefix is [Newsletter]', async () => {
    const { deps } = setup({ provider: fakeNewsletterProvider() })
    await deps.notify('a@b.pl')
    expect(setup().deps.logPrefix).toBe('[Newsletter]')
  })
})

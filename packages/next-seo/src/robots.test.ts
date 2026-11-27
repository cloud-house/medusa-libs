import { afterEach, describe, expect, it, vi } from 'vitest'
import { testSeo } from './fixtures'

const { buildRobots } = testSeo()

describe('buildRobots', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('keeps every crawler out without SITE_INDEXABLE=true', () => {
    vi.stubEnv('SITE_INDEXABLE', '')
    expect(buildRobots({ allow: ['/'], disallow: ['/konto'] })).toEqual({
      rules: { userAgent: '*', disallow: '/' },
    })
  })

  it('with SITE_INDEXABLE=true uses the shop rules and points to the sitemap', () => {
    vi.stubEnv('SITE_INDEXABLE', 'true')
    vi.stubEnv('SITE_URL', 'https://x.pl')
    expect(
      buildRobots({ allow: ['/', '/api/media/file/'], disallow: ['/konto', '/admin$'] }),
    ).toEqual({
      rules: { userAgent: '*', allow: ['/', '/api/media/file/'], disallow: ['/konto', '/admin$'] },
      sitemap: 'https://x.pl/sitemap.xml',
    })
  })
})

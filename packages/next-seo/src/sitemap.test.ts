import { afterEach, describe, expect, it, vi } from 'vitest'
import { testSeo } from './fixtures'

const { buildSitemap } = testSeo()

describe('buildSitemap', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('absolute addresses in the given order, each once, lastModified only when given', () => {
    vi.stubEnv('SITE_URL', 'https://x.pl')
    expect(
      buildSitemap([
        { path: '/' },
        { path: '/produkt/a', lastModified: '2026-11-01T00:00:00.000Z' },
        { path: '/marki' },
        { path: '/produkt/a', lastModified: '2026-11-02T00:00:00.000Z' },
      ]),
    ).toEqual([
      { url: 'https://x.pl/' },
      { url: 'https://x.pl/produkt/a', lastModified: '2026-11-01T00:00:00.000Z' },
      { url: 'https://x.pl/marki' },
    ])
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSeo } from './seo'

const { absoluteUrl, siteIndexable, siteUrl } = createSeo({
  siteName: 'Sklep',
  shopTitle: 'Sklep – test',
  feedDescription: 'Opis',
  devSiteUrl: 'http://localhost:3200',
})

describe('site URL', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('builds absolute URLs without double slashes', () => {
    vi.stubEnv('SITE_URL', 'https://chonasupa.pl/')
    expect(absoluteUrl('/deski-sup')).toBe('https://chonasupa.pl/deski-sup')
    expect(absoluteUrl('/')).toBe('https://chonasupa.pl/')
    vi.stubEnv('SITE_URL', 'https://chonasupa.pl')
    expect(absoluteUrl('/produkt/allround-wave?kolor=turkus')).toBe(
      'https://chonasupa.pl/produkt/allround-wave?kolor=turkus',
    )
  })

  it('keeps a path prefix', () => {
    vi.stubEnv('SITE_URL', 'https://example.com/sklep')
    expect(absoluteUrl('/deski-sup')).toBe('https://example.com/sklep/deski-sup')
  })

  it('defaults to the dev server outside production and fails loudly in production', () => {
    vi.stubEnv('SITE_URL', '')
    vi.stubEnv('NODE_ENV', 'development')
    expect(siteUrl().toString()).toBe('http://localhost:3200/')
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => siteUrl()).toThrow(/SITE_URL/)
  })

  it('an invalid address names the variable instead of a bare „Invalid URL”', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('SITE_URL', 'chonasupa.pl')
    expect(() => siteUrl()).toThrow(/SITE_URL.*chonasupa\.pl/)
    // `new URL` przyjmuje to jako protokół „localhost:” – to też nie adres sklepu.
    vi.stubEnv('SITE_URL', 'localhost:3200')
    expect(() => siteUrl()).toThrow(/SITE_URL/)
  })

  it('production requires https – except a production build run on this machine', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('SITE_URL', 'http://chonasupa.pl')
    expect(() => siteUrl()).toThrow(/SITE_URL.*https/)
    vi.stubEnv('SITE_URL', 'https://chonasupa.pl')
    expect(siteUrl().toString()).toBe('https://chonasupa.pl/')
    vi.stubEnv('SITE_URL', 'http://localhost:3200')
    expect(siteUrl().toString()).toBe('http://localhost:3200/')
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('SITE_URL', 'http://192.168.1.20:3200')
    expect(siteUrl().toString()).toBe('http://192.168.1.20:3200/')
  })

  it('indexing is on only with SITE_INDEXABLE=true', () => {
    vi.stubEnv('SITE_INDEXABLE', '')
    expect(siteIndexable()).toBe(false)
    vi.stubEnv('SITE_INDEXABLE', 'true')
    expect(siteIndexable()).toBe(true)
  })
})

describe('site URL options', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defaults the dev address to port 3000', () => {
    const seo = createSeo({ siteName: 'S', shopTitle: 'S', feedDescription: 'S' })
    vi.stubEnv('SITE_URL', '')
    vi.stubEnv('NODE_ENV', 'development')
    expect(seo.siteUrl().toString()).toBe('http://localhost:3000/')
  })

  it('gives a neutral example address in the error', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('SITE_URL', 'nie-adres')
    expect(() => siteUrl()).toThrow(/twoj-sklep\.pl/)
  })

  it('keeps a path prefix with or without a trailing slash', () => {
    vi.stubEnv('SITE_URL', 'https://x.pl/sklep/')
    expect(absoluteUrl('/produkt/a')).toBe('https://x.pl/sklep/produkt/a')
    vi.stubEnv('SITE_URL', 'https://x.pl/sklep')
    expect(absoluteUrl('/produkt/a')).toBe('https://x.pl/sklep/produkt/a')
  })

  it('reads SITE_URL on every call, not once per instance', () => {
    vi.stubEnv('SITE_URL', 'https://a.pl')
    expect(absoluteUrl('/')).toBe('https://a.pl/')
    vi.stubEnv('SITE_URL', 'https://b.pl')
    expect(absoluteUrl('/')).toBe('https://b.pl/')
  })
})

import { describe, expect, it } from 'vitest'
import { cachedInit } from './cached-init'

describe('cachedInit', () => {
  it('caches with tags and revalidate', () => {
    expect(cachedInit({ tags: ['catalog'], revalidate: 60 })).toEqual({
      cache: 'force-cache',
      next: { tags: ['catalog'], revalidate: 60 },
    })
  })

  it('adds the version header when version is given', () => {
    const init = cachedInit({
      tags: ['catalog'],
      revalidate: 60,
      versionHeader: 'x-shop-api-version',
      version: 5,
    })
    expect(init.headers).toEqual({ 'x-shop-api-version': '5' })
  })

  it('adds no header without both versionHeader and version', () => {
    expect(cachedInit({ tags: [], revalidate: 1, version: 2 }).headers).toBeUndefined()
    expect(cachedInit({ tags: [], revalidate: 1, versionHeader: 'x-v' }).headers).toBeUndefined()
  })
})

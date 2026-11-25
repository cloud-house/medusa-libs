import { describe, expect, it } from 'vitest'
import {
  ARTICLES_PER_PAGE,
  parsePageParam,
  pickRelated,
  publishedLabel,
  readingLabel,
} from './article-rules'

describe('parsePageParam', () => {
  it.each([
    [undefined, 1],
    ['1', 1],
    ['2', 2],
    ['13', 13],
    ['0', null],
    ['02', null],
    ['abc', null],
    ['-1', null],
    ['1.5', null],
    ['', null],
    [['2', '3'], null],
  ] as const)('%j → %j', (value, expected) => {
    expect(parsePageParam(value as string | string[] | undefined)).toBe(expected)
  })

  it('strona listy ma 12 kafli', () => {
    expect(ARTICLES_PER_PAGE).toBe(12)
  })
})

describe('pickRelated', () => {
  const a = { slug: 'a' }
  const b = { slug: 'b' }
  const c = { slug: 'c' }
  const d = { slug: 'd' }
  const e = { slug: 'e' }

  it('najpierw ta sama kategoria, potem najnowsze, bez bieżącego i powtórek', () => {
    expect(pickRelated('a', [a, b], [c, b, d])).toEqual([b, c, d])
  })

  it('ogranicza do trzech', () => {
    expect(pickRelated('x', [a, b], [c, d, e])).toEqual([a, b, c])
  })

  it('pusta lista, gdy nie ma innych artykułów', () => {
    expect(pickRelated('a', [a], [a])).toEqual([])
  })
})

describe('etykiety', () => {
  it('czas czytania', () => {
    expect(readingLabel(6)).toBe('6 min')
  })

  it('data publikacji po polsku w strefie Warszawy', () => {
    expect(publishedLabel('2026-10-21T08:00:00.000Z')).toBe('21 października 2026')
    expect(publishedLabel('2026-10-20T23:30:00.000Z')).toBe('21 października 2026')
    expect(publishedLabel(null)).toBeNull()
    expect(publishedLabel('nie-data')).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import {
  CORE_HOME_BLOCK_LABELS,
  CORE_HOME_BLOCK_TYPES,
  CORE_HOME_LAYOUT_RULES,
  homeLayoutError,
} from './home-layout'

const blocks = (...types: string[]) => types.map((blockType) => ({ blockType }))

describe('homeLayoutError', () => {
  it('wymaga co najmniej jednego bloku', () => {
    expect(homeLayoutError([])).toBe('Dodaj co najmniej jeden blok.')
    expect(homeLayoutError(null)).toBe('Dodaj co najmniej jeden blok.')
    expect(homeLayoutError(undefined)).toBe('Dodaj co najmniej jeden blok.')
  })

  it('pozwala na jeden blok „Hero”', () => {
    expect(homeLayoutError(blocks('hero', 'articles', 'hero'))).toBe(
      'Strona główna może mieć tylko jeden blok „Hero”.',
    )
  })

  it('wymaga hero na początku', () => {
    expect(homeLayoutError(blocks('articles', 'hero'))).toBe(
      'Hero musi być pierwszym blokiem strony głównej.',
    )
    expect(homeLayoutError(blocks('trustBar'))).toBe(
      'Hero musi być pierwszym blokiem strony głównej.',
    )
  })

  it('pozwala na jeden pasek zalet i jeden newsletter', () => {
    expect(homeLayoutError(blocks('hero', 'trustBar', 'trustBar'))).toBe(
      'Blok „Pasek zalet” może wystąpić tylko raz.',
    )
    expect(homeLayoutError(blocks('hero', 'newsletter', 'articles', 'newsletter'))).toBe(
      'Blok „Newsletter” może wystąpić tylko raz.',
    )
  })

  it('reguły sklepu: dodatkowy blok jednokrotny z etykietą albo samym kluczem', () => {
    const rules = {
      labels: { ...CORE_HOME_LAYOUT_RULES.labels, quizPromo: 'Quiz' },
      single: [...CORE_HOME_LAYOUT_RULES.single, 'quizPromo', 'gallery'],
    }
    expect(homeLayoutError(blocks('hero', 'quizPromo', 'articles', 'quizPromo'), rules)).toBe(
      'Blok „Quiz” może wystąpić tylko raz.',
    )
    expect(homeLayoutError(blocks('hero', 'gallery', 'gallery'), rules)).toBe(
      'Blok „gallery” może wystąpić tylko raz.',
    )
    expect(homeLayoutError(blocks('hero', 'unknownBlock'))).toBe(true)
  })

  it('przepuszcza poprawny układ i powtórzone bloki treści', () => {
    expect(homeLayoutError(blocks('hero', 'trustBar', 'newsletter', 'articles'))).toBe(true)
    expect(homeLayoutError(blocks('hero', 'articles', 'articles'))).toBe(true)
    expect(homeLayoutError(blocks(...CORE_HOME_BLOCK_TYPES))).toBe(true)
  })

  it('ma etykietę dla każdego typu bloku', () => {
    expect(Object.keys(CORE_HOME_BLOCK_LABELS).sort()).toEqual([...CORE_HOME_BLOCK_TYPES].sort())
  })
})

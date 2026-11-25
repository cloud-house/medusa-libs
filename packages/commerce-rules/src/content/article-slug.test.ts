import { describe, expect, it } from 'vitest'
import {
  articleSlugError,
  articleSlugFromTitle,
  categorySlugError,
  isArticleSlug,
} from './article-slug'

describe('adres artykułu', () => {
  it('odrzuca zarezerwowany adres „kategoria”', () => {
    expect(articleSlugError('kategoria')).toBe('Adres „kategoria” jest zajęty – wybierz inny.')
    expect(isArticleSlug('kategoria')).toBe(false)
  })

  it('wymaga formatu adresu i niepustej wartości', () => {
    const format =
      'Adres: małe litery bez polskich znaków, cyfry i myślniki (np. jak-wybrac-deske).'
    expect(articleSlugError('Jak wybrać')).toBe(format)
    expect(articleSlugError('a--b')).toBe(format)
    expect(articleSlugError('')).toBe('Podaj adres artykułu.')
    expect(articleSlugError(undefined)).toBe('Podaj adres artykułu.')
  })

  it('przepuszcza poprawny adres', () => {
    expect(articleSlugError('ile-psi')).toBeNull()
    expect(isArticleSlug('ile-psi')).toBe(true)
  })
})

describe('adres kategorii', () => {
  it('sprawdza tylko format', () => {
    expect(categorySlugError('sprzet')).toBeNull()
    expect(categorySlugError('kategoria')).toBeNull()
    expect(categorySlugError('Sprzęt')).toBe(
      'Adres: małe litery bez polskich znaków, cyfry i myślniki (np. sprzet).',
    )
    expect(categorySlugError(' ')).toBe('Podaj adres kategorii.')
  })
})

describe('długie adresy artykułów', () => {
  it('za długi adres dostaje komunikat o długości, a nie o formacie', () => {
    expect(articleSlugError(`${'a'.repeat(40)}-${'b'.repeat(40)}`)).toBe(
      'Adres może mieć najwyżej 80 znaków – skróć go.',
    )
  })

  it('adres z długiego tytułu jest ucinany na granicy słowa do 80 znaków', () => {
    const title =
      'Jak wybrać deskę SUP dla dziecka i całej rodziny – poradnik krok po kroku na pierwszy sezon nad jeziorem'
    const slug = articleSlugFromTitle(title)
    expect(slug.length).toBeLessThanOrEqual(80)
    expect(slug.endsWith('-')).toBe(false)
    expect(articleSlugError(slug)).toBeNull()
    expect(slug.startsWith('jak-wybrac-deske-sup-dla-dziecka')).toBe(true)
    expect(articleSlugFromTitle('Ile PSI?')).toBe('ile-psi')
  })
})

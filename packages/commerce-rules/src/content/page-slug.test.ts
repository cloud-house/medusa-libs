import { describe, expect, it } from 'vitest'
import { isPageSlug, isProtectedPageSlug, pageSlugError } from './page-slug'

describe('adres strony informacyjnej', () => {
  it('przyjmuje małe litery, cyfry i pojedyncze myślniki', () => {
    expect(pageSlugError('dostawa-i-zwroty')).toBeNull()
    expect(pageSlugError('o-nas')).toBeNull()
    expect(isPageSlug('serwis2026')).toBe(true)
  })

  it('odrzuca wielkie i polskie litery, spacje i podwójne myślniki', () => {
    for (const slug of [
      'Dostawa i zwroty',
      'żółw',
      'a--b',
      '-o-nas',
      'o-nas-',
      'a/b',
      'a'.repeat(81),
    ]) {
      expect(isPageSlug(slug), slug).toBe(false)
      expect(pageSlugError(slug), slug).toBe(
        'Adres: małe litery bez polskich znaków, cyfry i myślniki (np. dostawa-i-zwroty).',
      )
    }
  })

  it('wymaga adresu', () => {
    expect(pageSlugError('')).toBe('Podaj adres strony.')
    expect(pageSlugError(null)).toBe('Podaj adres strony.')
  })

  it('nie pozwala zająć adresu sklepu', () => {
    expect(pageSlugError('admin')).toBe('Adres „admin” zajmuje już sklep – wybierz inny.')
    expect(pageSlugError('koszyk', ['koszyk'])).toBe(
      'Adres „koszyk” zajmuje już sklep – wybierz inny.',
    )
    expect(pageSlugError('koszyk')).toBeNull()
  })

  it('chronione strony podaje sklep', () => {
    expect(isProtectedPageSlug('regulamin', ['regulamin'])).toBe(true)
    expect(isProtectedPageSlug('o-nas', ['regulamin'])).toBe(false)
    expect(isProtectedPageSlug(null, [])).toBe(false)
  })
})

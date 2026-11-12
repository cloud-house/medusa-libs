import { describe, expect, it } from 'vitest'
import { formatPrice } from './format-price'

const NBSP = ' '

describe('formatPrice', () => {
  it('groups thousands with a non-breaking space, like the design ("1 899 zł")', () => {
    expect(formatPrice(1899)).toBe(`1${NBSP}899${NBSP}zł`)
  })

  it('does not group amounts below 1000', () => {
    expect(formatPrice(89)).toBe(`89${NBSP}zł`)
  })

  it('groups every three digits in large amounts', () => {
    expect(formatPrice(1234567)).toBe(`1${NBSP}234${NBSP}567${NBSP}zł`)
  })

  it('formats zero', () => {
    expect(formatPrice(0)).toBe(`0${NBSP}zł`)
  })

  it('shows grosze with a comma only when the amount is fractional', () => {
    expect(formatPrice(1899.5)).toBe(`1${NBSP}899,50${NBSP}zł`)
    expect(formatPrice(19.99)).toBe(`19,99${NBSP}zł`)
  })

  it('rounds floating-point noise to whole grosze', () => {
    expect(formatPrice(0.1 + 0.2)).toBe(`0,30${NBSP}zł`)
  })

  it('prefixes negative amounts with a minus sign, but never shows "−0"', () => {
    expect(formatPrice(-449)).toBe(`−449${NBSP}zł`)
    expect(formatPrice(-0.001)).toBe(`0${NBSP}zł`)
  })

  it('rejects non-finite amounts', () => {
    expect(() => formatPrice(Number.NaN)).toThrow(RangeError)
    expect(() => formatPrice(Number.POSITIVE_INFINITY)).toThrow(RangeError)
  })

  it('gives the same result for explicit PLN + pl options', () => {
    expect(formatPrice(1899, { currency: 'PLN', locale: 'pl' })).toBe(formatPrice(1899))
  })

  it('formats other currency/locale pairs with Intl.NumberFormat and never adds zł', () => {
    const result = formatPrice(1899.5, { currency: 'EUR', locale: 'de' })
    expect(result).toBe(
      new Intl.NumberFormat('de', { style: 'currency', currency: 'EUR' }).format(1899.5),
    )
    expect(result).not.toContain('zł')
  })

  it('throws RangeError on NaN for other currencies too', () => {
    expect(() => formatPrice(Number.NaN, { currency: 'EUR' })).toThrow(RangeError)
  })

  it("treats 'pl-PL' (and any pl-* / case variant) like 'pl'", () => {
    const expected = formatPrice(189900)
    expect(formatPrice(189900, { locale: 'pl-PL' })).toBe(expected)
    expect(formatPrice(189900, { locale: 'PL-pl' })).toBe(expected)
    expect(formatPrice(189900, { locale: 'PL' })).toBe(expected)
  })

  it('throws a RangeError for an invalid currency code (Intl.NumberFormat)', () => {
    expect(() => formatPrice(10, { currency: 'ZZ' })).toThrow(RangeError)
  })
})

import { describe, expect, it } from 'vitest'
import { labelHref, labelOrderNumber } from './label'

describe('labelOrderNumber', () => {
  it('przyjmuje numer zamówienia z cyfr', () => {
    expect(labelOrderNumber('1001')).toBe('1001')
    expect(labelOrderNumber(' 1001 ')).toBe('1001')
    expect(labelOrderNumber('1')).toBe('1')
    expect(labelOrderNumber('1234567890')).toBe('1234567890')
  })

  it('z powtórzonego parametru bierze pierwszą wartość', () => {
    expect(labelOrderNumber(['1002', 'x'])).toBe('1002')
    expect(labelOrderNumber(['x', '1002'])).toBeNull()
  })

  it('zdejmuje # z przodu', () => {
    expect(labelOrderNumber('#1003')).toBe('1003')
    expect(labelOrderNumber('##1003')).toBeNull()
  })

  it('odrzuca wszystko poza 1–10 cyframi', () => {
    for (const value of [
      '10a',
      '<script>',
      '<b>1</b>',
      '1001"><img src=x>',
      '12345678901',
      '10 01',
      '-5',
      '1.5',
      '１２３',
      '',
      '   ',
      '#',
      '# 1003',
      [],
      undefined,
      null,
      1001,
      {},
    ]) {
      expect(labelOrderNumber(value), JSON.stringify(value)).toBeNull()
    }
  })
})

describe('labelHref', () => {
  it('adres etykiety z numerem zamówienia', () => {
    expect(labelHref(1001)).toBe('/zwrot/etykieta?zamowienie=1001')
  })
})

import { describe, expect, it } from 'vitest'
import { pluralize, pluralizePl } from './pluralize'

const PRODUCT_FORMS = ['produkt', 'produkty', 'produktów'] as const
const BOARD_FORMS = ['deska', 'deski', 'desek'] as const
const MODEL_FORMS = ['model', 'modele', 'modeli'] as const

describe('pluralizePl', () => {
  it.each([
    [0, 'produktów'],
    [1, 'produkt'],
    [2, 'produkty'],
    [4, 'produkty'],
    [5, 'produktów'],
    [11, 'produktów'],
    [12, 'produktów'],
    [14, 'produktów'],
    [21, 'produktów'],
    [22, 'produkty'],
    [25, 'produktów'],
    [101, 'produktów'],
    [102, 'produkty'],
    [112, 'produktów'],
    [122, 'produkty'],
  ])('%i → %s', (count, expected) => {
    expect(pluralizePl(count, PRODUCT_FORMS)).toBe(expected)
  })
})

describe('formy rzeczowników na listach', () => {
  it('deska / deski / desek', () => {
    expect([1, 3, 5, 12, 22].map((n) => pluralizePl(n, BOARD_FORMS))).toEqual([
      'deska',
      'deski',
      'desek',
      'desek',
      'deski',
    ])
  })

  it('model / modele / modeli', () => {
    expect([1, 2, 5, 12, 22].map((n) => pluralizePl(n, MODEL_FORMS))).toEqual([
      'model',
      'modele',
      'modeli',
      'modeli',
      'modele',
    ])
  })
})

describe('pluralize (Intl.PluralRules)', () => {
  const forms = { one: 'produkt', few: 'produkty', many: 'produktów', other: 'produktu' }

  it('defaults to Polish rules', () => {
    expect(pluralize(5, forms)).toBe('produktów')
    expect(pluralize(22, forms)).toBe('produkty')
  })

  it('supports other locales', () => {
    expect(pluralize(1, { one: 'item', other: 'items' }, { locale: 'en' })).toBe('item')
    expect(pluralize(3, { one: 'item', other: 'items' }, { locale: 'en' })).toBe('items')
  })

  it('falls back to other when a category is missing', () => {
    expect(pluralize(5, { one: 'x', other: 'y' })).toBe('y')
  })
})

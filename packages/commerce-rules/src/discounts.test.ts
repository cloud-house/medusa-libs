import { describe, expect, it } from 'vitest'
import {
  DISCOUNT_LABEL_MESSAGES,
  type DiscountedLine,
  lineDiscountLabel,
  splitLineDiscount,
} from './discounts'

const typed = (code: string) => code !== 'WIOSLO-Z-DESKA'

// A carbon paddle with the bundle discount and a typed -10% code – numbers from a Medusa 2.21 cart
// (the bundle adjustment is stored net, the code one net or gross depending on the promotion).
const paddle = (code: { amount: number; is_tax_inclusive: boolean }): DiscountedLine => ({
  original_total: 749,
  subtotal: 608.9430894308944,
  total: 404.4599999999999,
  adjustments: [
    { code: 'WIOSLO-Z-DESKA', amount: 243.57723577235777, is_tax_inclusive: false },
    { code: 'LATO10', ...code },
  ],
})

describe('splitLineDiscount', () => {
  it('splits a line with the bundle discount and a code into gross parts', () => {
    for (const code of [
      { amount: 36.53658536585366, is_tax_inclusive: false },
      { amount: 44.94, is_tax_inclusive: true },
    ]) {
      expect(splitLineDiscount(paddle(code), typed)).toEqual({
        bundle: 299.6,
        code: 44.94,
        codes: ['LATO10'],
      })
    }
  })

  it('a line with only the bundle or only a code', () => {
    expect(
      splitLineDiscount(
        {
          original_total: 749,
          total: 449.4,
          adjustments: [{ code: 'WIOSLO-Z-DESKA', amount: 299.6, is_tax_inclusive: true }],
        },
        typed,
      ),
    ).toEqual({ bundle: 299.6, code: 0, codes: [] })
    expect(
      splitLineDiscount(
        {
          original_total: 249,
          total: 224.1,
          adjustments: [{ code: 'WIOSNA10', amount: 24.9, is_tax_inclusive: true }],
        },
        typed,
      ),
    ).toEqual({ bundle: 0, code: 24.9, codes: ['WIOSNA10'] })
  })

  it('without adjustment amounts a typed code takes the whole discount', () => {
    expect(
      splitLineDiscount(
        { original_total: 249, total: 224.1, adjustments: [{ code: 'WIOSNA10' }] },
        typed,
      ),
    ).toEqual({ bundle: 0, code: 24.9, codes: ['WIOSNA10'] })
  })

  it('a line without a discount has no parts', () => {
    expect(
      splitLineDiscount({ original_total: 1899, total: 1899, adjustments: [] }, typed),
    ).toEqual({ bundle: 0, code: 0, codes: [] })
  })
})

describe('lineDiscountLabel', () => {
  it('names the bundle, the code or both', () => {
    expect(lineDiscountLabel({ bundle: 299.6, code: 0, codes: [] })).toBe('Rabat zestawowy')
    expect(lineDiscountLabel({ bundle: 0, code: 24.9, codes: ['WIOSNA10'] })).toBe('Kod WIOSNA10')
    expect(lineDiscountLabel({ bundle: 299.6, code: 44.94, codes: ['LATO10'] })).toBe(
      'Rabat zestawowy + kod LATO10',
    )
  })
})

describe('lineDiscountLabel options', () => {
  const bundle = { bundle: 10, code: 0, codes: [] }
  const code = { bundle: 0, code: 5, codes: ['A', 'B'] }
  const both = { bundle: 10, code: 5, codes: ['A'] }

  it('defaults to Polish, byte-identical to the old output', () => {
    expect(lineDiscountLabel(bundle)).toBe('Rabat zestawowy')
    expect(lineDiscountLabel(code)).toBe('Kod A, B')
    expect(lineDiscountLabel(both)).toBe('Rabat zestawowy + kod A')
    expect(DISCOUNT_LABEL_MESSAGES.pl.bundle).toBe('Rabat zestawowy')
  })

  it('en dictionary', () => {
    expect(lineDiscountLabel(bundle, { locale: 'en' })).toBe('Bundle discount')
    expect(lineDiscountLabel(code, { locale: 'en' })).toBe('Code A, B')
    expect(lineDiscountLabel(both, { locale: 'en' })).toBe('Bundle discount + code A')
  })

  it('messages override per key; explicit undefined keeps the default', () => {
    expect(lineDiscountLabel(both, { messages: { bundleAndCode: 'Zestaw i {codes}' } })).toBe(
      'Zestaw i A',
    )
    expect(lineDiscountLabel(bundle, { locale: 'en', messages: { bundle: undefined } })).toBe(
      'Bundle discount',
    )
  })
})

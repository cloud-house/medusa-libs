import { describe, expect, it } from 'vitest'
import { type DiscountedLine, lineDiscountLabel, splitLineDiscount } from './discounts'

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

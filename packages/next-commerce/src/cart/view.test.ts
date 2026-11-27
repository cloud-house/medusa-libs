import type { HttpTypes } from '@medusajs/types'
import { describe, expect, it } from 'vitest'
import {
  boardLine,
  orphanCart,
  paddleUpgradeLine,
  TEST_VARIANT_OPTIONS,
  testCart,
} from './test-cart'
import { groupByUpgrade, productLink } from './test-shop-options'
import { toCartView } from './view'

const opts = {
  freeShippingThreshold: 500,
  variants: TEST_VARIANT_OPTIONS,
  groupLines: groupByUpgrade,
  href: productLink,
  hiddenSize: 'Standard',
}

describe('toCartView without the shop options', () => {
  it('lists every line on its own with a /products link and the size as given', () => {
    const view = toCartView(testCart(), {
      freeShippingThreshold: 500,
      variants: TEST_VARIANT_OPTIONS,
    })
    expect(view?.groups.map((g) => [g.line.id, g.upgrades.length])).toEqual([
      ['item_board', 0],
      ['item_paddle', 0],
      ['item_vest', 0],
    ])
    expect(view?.groups[0]?.line.href).toBe('/products/allround-wave')
  })
})

describe('toCartView', () => {
  it('marka i kategoria pozycji z katalogu (zdarzenia analityki); bez nich – null', () => {
    const view = toCartView(testCart(), opts)
    expect(view?.groups[0]?.line).toMatchObject({ brand: 'Aqua Marina', category: 'Allround' })
    expect(view?.groups[0]?.upgrades[0]).toMatchObject({ brand: 'Aqua Marina', category: 'Wiosła' })
    expect(view?.groups[1]?.line).toMatchObject({ brand: null, category: null })
  })

  it('groups an upgrade under its board and keeps other items separate, in adding order', () => {
    const view = toCartView(testCart(), opts)

    expect(view?.groups.map((g) => [g.line.id, g.upgrades.map((u) => u.id)])).toEqual([
      ['item_board', ['item_paddle']],
      ['item_vest', []],
    ])
    expect(view?.count).toBe(3)
  })

  it('describes each line: variant, link, totals, replaced kit item', () => {
    const view = toCartView(testCart(), opts)
    const board = view?.groups[0]?.line
    const paddle = view?.groups[0]?.upgrades[0]

    expect(board).toMatchObject({
      title: 'Allround Wave',
      variantLabel: `Turkus · 10'6"`,
      href: '/produkt/allround-wave?kolor=turkus&rozmiar=10-6',
      quantity: 1,
      total: 1899,
      originalTotal: 1899,
      discount: null,
      replaces: null,
    })
    expect(paddle).toMatchObject({
      variantLabel: 'Regulowane 170–210 cm',
      total: 449.4,
      originalTotal: 749,
      discount: { label: 'Rabat zestawowy', code: 0 },
      replaces: 'Wiosło alu 3-cz.',
    })
    expect(view?.groups[1]?.line.discount).toEqual({ label: 'Kod WIOSNA10', code: 24.9 })
  })

  it('without catalog data falls back to the variant title and a plain product link', () => {
    const board = toCartView(testCart(), { freeShippingThreshold: 500, href: productLink })
      ?.groups[0]?.line

    expect(board).toMatchObject({ variantLabel: `10'6" / Turkus`, href: '/produkt/allround-wave' })
  })

  it('sums bundle and code discounts separately and lists the applied codes', () => {
    const view = toCartView(testCart(), opts)

    expect(view).toMatchObject({
      originalItemTotal: 2897,
      itemTotal: 2572.5,
      total: 2572.5,
      codes: ['WIOSNA10'],
    })
    expect(view?.bundleDiscount).toBeCloseTo(299.6, 2)
    expect(view?.codeDiscount).toBeCloseTo(24.9, 2)
  })

  it('a line with the bundle discount and a code: both named, each counted in its own row', () => {
    // Liczby z koszyka Medusy 2.21: korekta zestawowa netto, kod −10% netto (`is_tax_inclusive`).
    const paddle = {
      ...paddleUpgradeLine,
      subtotal: 608.9430894308944,
      total: 404.46,
      adjustments: [
        { id: 'adj_1', code: 'WIOSLO-Z-DESKA', amount: 243.5772357723578, is_tax_inclusive: false },
        { id: 'adj_2', code: 'LATO10', amount: 36.53658536585366, is_tax_inclusive: false },
      ],
    }
    const view = toCartView(
      testCart({
        items: [boardLine, paddle] as HttpTypes.StoreCartLineItem[],
        promotions: [
          { id: 'promo_bundle', code: 'WIOSLO-Z-DESKA', is_automatic: true },
          { id: 'promo_lato', code: 'LATO10', is_automatic: false },
        ] as HttpTypes.StoreCart['promotions'],
      }),
      opts,
    )

    expect(view?.groups[0]?.upgrades[0]?.discount?.label).toBe('Rabat zestawowy + kod LATO10')
    expect(view?.bundleDiscount).toBe(299.6)
    expect(view?.codeDiscount).toBe(44.94)
  })

  it('measures free shipping from the item total after discounts', () => {
    expect(toCartView(testCart(), opts)?.freeShipping).toEqual({
      threshold: 500,
      remaining: 0,
      reached: true,
      progress: 1,
    })
    expect(toCartView(testCart({ item_total: 300 }), opts)?.freeShipping).toEqual({
      threshold: 500,
      remaining: 200,
      reached: false,
      progress: 0.6,
    })
  })

  it('shows an upgrade whose board was removed as its own group without a discount', () => {
    const view = toCartView(orphanCart(), opts)

    expect(view?.groups).toHaveLength(1)
    expect(view?.groups[0]?.line).toMatchObject({
      id: 'item_paddle',
      discount: null,
      // Bez deski nie ma zestawu – „zamiast Wiosło alu” wprowadzałoby w błąd.
      replaces: null,
    })
    expect(view?.groups[0]?.upgrades).toEqual([])
  })

  it('returns null for no cart and for an empty one', () => {
    expect(toCartView(null, opts)).toBeNull()
    expect(toCartView(testCart({ items: [] }), opts)).toBeNull()
  })
})

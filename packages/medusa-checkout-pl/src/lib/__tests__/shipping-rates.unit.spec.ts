import { type ShippingOptionRow, toShippingRate } from '../shipping-rates'

const PL = { currency: 'pln', regionId: 'reg_pl' }
const region = { attribute: 'region_id', operator: 'eq', value: 'reg_pl' }
const freeFrom = (value: number) => ({
  attribute: 'item_total',
  operator: 'gte',
  value: String(value),
})

const option = (over: Partial<ShippingOptionRow> = {}): ShippingOptionRow => ({
  id: 'so_dpd',
  name: 'Kurier DPD',
  type: { code: 'kurier-dpd', description: 'Dostawa w 1–2 dni robocze.' },
  prices: [
    { amount: 16.99, currency_code: 'pln', price_rules: [] },
    { amount: 0, currency_code: 'pln', price_rules: [freeFrom(500)] },
  ],
  rules: [
    { attribute: 'enabled_in_store', value: 'true' },
    { attribute: 'is_return', value: 'false' },
  ],
  ...over,
})

describe('toShippingRate', () => {
  it('base price and the free-shipping threshold from the price rules', () => {
    expect(toShippingRate(option(), PL)).toEqual({
      id: 'so_dpd',
      code: 'kurier-dpd',
      name: 'Kurier DPD',
      description: 'Dostawa w 1–2 dni robocze.',
      amount: 16.99,
      free_from: 500,
    })
  })

  it('the region price wins over the currency price, like Medusa pricing (most rules first)', () => {
    const rate = toShippingRate(
      option({
        prices: [
          { amount: 16.99, currency_code: 'pln', price_rules: [] },
          { amount: 0, currency_code: 'pln', price_rules: [freeFrom(500)] },
          { amount: 19.99, currency_code: 'pln', price_rules: [region] },
          { amount: 0, currency_code: 'pln', price_rules: [region, freeFrom(600)] },
        ],
      }),
      PL,
    )
    expect(rate).toMatchObject({ amount: 19.99, free_from: 600 })
  })

  it('prices of another region are ignored', () => {
    const rate = toShippingRate(
      option({
        prices: [
          { amount: 16.99, currency_code: 'pln', price_rules: [] },
          { amount: 9.99, currency_code: 'pln', price_rules: [{ ...region, value: 'reg_de' }] },
        ],
      }),
      PL,
    )
    expect(rate).toMatchObject({ amount: 16.99, free_from: null })
  })

  it('no threshold rule – never free', () => {
    const [base] = option().prices ?? []
    expect(toShippingRate(option({ prices: [base ?? null] }), PL)?.free_from).toBeNull()
  })

  it('ignores prices in another currency', () => {
    const rate = toShippingRate(
      option({
        prices: [
          { amount: 4, currency_code: 'eur', price_rules: [] },
          { amount: '16.99', currency_code: 'pln', price_rules: null },
        ],
      }),
      PL,
    )
    expect(rate?.amount).toBe(16.99)
  })

  it('return options and options hidden from the store are skipped', () => {
    expect(
      toShippingRate(
        option({
          rules: [
            { attribute: 'enabled_in_store', value: 'true' },
            { attribute: 'is_return', value: 'true' },
          ],
        }),
        PL,
      ),
    ).toBeNull()
    expect(
      toShippingRate(option({ rules: [{ attribute: 'enabled_in_store', value: 'false' }] }), PL),
    ).toBeNull()
  })

  it('an option without a base price is skipped', () => {
    expect(toShippingRate(option({ prices: [] }), PL)).toBeNull()
  })
})

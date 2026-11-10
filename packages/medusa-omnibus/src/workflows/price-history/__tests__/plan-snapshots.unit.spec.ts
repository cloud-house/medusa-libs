import { planPriceSnapshots } from '../plan-snapshots'

const ctx = {
  region_id: 'reg_pl',
  currency_code: 'pln',
  recorded_at: new Date('2026-10-16T12:00:00Z'),
}

describe('planPriceSnapshots', () => {
  it('records variants without any snapshot', () => {
    expect(
      planPriceSnapshots(
        [{ variant_id: 'v1', amount: 1899, original_amount: 2199 }],
        new Map(),
        ctx,
      ),
    ).toEqual([{ variant_id: 'v1', amount: 1899, original_amount: 2199, ...ctx }])
  })

  it('records only changed amounts', () => {
    const latest = new Map([
      ['v1', { amount: 1899, original_amount: 2199 }],
      ['v2', { amount: 1899, original_amount: 2199 }],
    ])
    const planned = planPriceSnapshots(
      [
        { variant_id: 'v1', amount: 1899.004, original_amount: 2199 },
        { variant_id: 'v2', amount: 1799, original_amount: 2199 },
      ],
      latest,
      ctx,
    )
    expect(planned.map((s) => [s.variant_id, s.amount])).toEqual([['v2', 1799]])
  })

  it('records a change of the regular price alone', () => {
    const latest = new Map([['v1', { amount: 1899, original_amount: 2199 }]])
    const planned = planPriceSnapshots(
      [{ variant_id: 'v1', amount: 1899, original_amount: 2299 }],
      latest,
      ctx,
    )
    expect(planned).toEqual([{ variant_id: 'v1', amount: 1899, original_amount: 2299, ...ctx }])
  })
})

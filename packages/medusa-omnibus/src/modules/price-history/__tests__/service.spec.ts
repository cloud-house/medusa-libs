import { moduleIntegrationTestRunner } from '@medusajs/test-utils'
import { PRICE_HISTORY_MODULE } from '..'
import { PriceSnapshot } from '../models/price-snapshot'
import type PriceHistoryModuleService from '../service'

jest.setTimeout(60 * 1000)

const at = (iso: string) => new Date(iso)

moduleIntegrationTestRunner<PriceHistoryModuleService>({
  moduleName: PRICE_HISTORY_MODULE,
  moduleModels: [PriceSnapshot],
  resolve: './src/modules/price-history',
  testSuite: ({ service }) => {
    describe('PriceHistoryModuleService', () => {
      beforeEach(async () => {
        const base = { currency_code: 'pln' }
        await service.createPriceSnapshots([
          {
            ...base,
            variant_id: 'v1',
            region_id: 'reg_pl',
            amount: 2199,
            original_amount: 2199,
            recorded_at: at('2026-09-01T00:00:00Z'),
          },
          {
            ...base,
            variant_id: 'v1',
            region_id: 'reg_pl',
            amount: 1899,
            original_amount: 2199,
            recorded_at: at('2026-10-04T00:00:00Z'),
          },
          {
            ...base,
            variant_id: 'v1',
            region_id: 'reg_de',
            amount: 99,
            original_amount: 99,
            recorded_at: at('2026-10-10T00:00:00Z'),
          },
          {
            ...base,
            variant_id: 'v2',
            region_id: 'reg_pl',
            amount: 749,
            original_amount: 749,
            recorded_at: at('2026-09-15T00:00:00Z'),
          },
        ])
      })

      it('returns the latest snapshot per variant and region', async () => {
        const latest = await service.listLatestByVariant(['v1', 'v2', 'v3'], 'reg_pl')

        expect([...latest.keys()].sort()).toEqual(['v1', 'v2'])
        expect(latest.get('v1')).toEqual(
          expect.objectContaining({ amount: 1899, original_amount: 2199 }),
        )
        expect(latest.get('v2')).toEqual(expect.objectContaining({ amount: 749 }))
      })

      it('returns history in chronological order', async () => {
        const history = await service.listHistoryByVariant(['v1'], 'reg_pl')

        expect(history.get('v1')?.map((p) => p.amount)).toEqual([2199, 1899])
        expect(new Date(history.get('v1')?.[0]?.recorded_at ?? 0).toISOString()).toBe(
          '2026-09-01T00:00:00.000Z',
        )
      })

      it('returns empty maps for no variants', async () => {
        expect((await service.listLatestByVariant([], 'reg_pl')).size).toBe(0)
        expect((await service.listHistoryByVariant([], 'reg_pl')).size).toBe(0)
      })
    })
  },
})

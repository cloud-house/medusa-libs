import { moduleIntegrationTestRunner } from '@medusajs/test-utils'
import { DEFAULT_FAVORITES_LIMIT as FAVORITES_LIMIT } from '../../../options'
import { FAVORITE_MODULE } from '..'
import { Favorite } from '../models/favorite'
import type FavoriteModuleService from '../service'

jest.setTimeout(60 * 1000)

const at = (iso: string) => new Date(iso)

moduleIntegrationTestRunner<FavoriteModuleService>({
  moduleName: FAVORITE_MODULE,
  moduleModels: [Favorite],
  resolve: './src/modules/favorite',
  testSuite: ({ service }) => {
    describe('FavoriteModuleService', () => {
      it('adds once, lists newest first and only for the customer', async () => {
        expect(await service.addForCustomer('cus_1', 'p1', at('2026-10-01T00:00:00Z'))).toBe(
          'added',
        )
        expect(await service.addForCustomer('cus_1', 'p1', at('2026-10-02T00:00:00Z'))).toBe(
          'exists',
        )
        await service.addForCustomer('cus_1', 'p2', at('2026-10-03T00:00:00Z'))
        await service.addForCustomer('cus_2', 'p3', at('2026-10-04T00:00:00Z'))

        expect(await service.listForCustomer('cus_1')).toEqual([
          { product_id: 'p2', added_at: at('2026-10-03T00:00:00Z') },
          { product_id: 'p1', added_at: at('2026-10-01T00:00:00Z') },
        ])
      })

      it('stops at the limit', async () => {
        await service.createFavorites(
          Array.from({ length: FAVORITES_LIMIT }, (_, i) => ({
            customer_id: 'cus_1',
            product_id: `p${i}`,
            added_at: at('2026-10-01T00:00:00Z'),
          })),
        )
        expect(await service.addForCustomer('cus_1', 'nowy', at('2026-10-02T00:00:00Z'))).toBe(
          'limit',
        )
        expect(await service.listForCustomer('cus_1')).toHaveLength(FAVORITES_LIMIT)
      })

      it('a duplicate insert from a concurrent add counts as already there', async () => {
        // Two tabs add the same product at once – both check before either inserts.
        const outcomes = await Promise.all([
          service.addForCustomer('cus_1', 'p1', at('2026-10-01T00:00:00Z')),
          service.addForCustomer('cus_1', 'p1', at('2026-10-01T00:00:01Z')),
        ])
        expect(outcomes.sort()).toEqual(['added', 'exists'])
        expect(await service.listForCustomer('cus_1')).toHaveLength(1)
      })

      it('merge: newer dates, hidden rows kept but not listed, incoming hidden dropped', async () => {
        await service.addForCustomer('cus_1', 'p1', at('2026-10-01T00:00:00Z'))
        await service.addForCustomer('cus_1', 'hidden', at('2026-10-02T00:00:00Z'))
        const result = await service.mergeForCustomer(
          'cus_1',
          [
            { product_id: 'p1', added_at: at('2026-10-05T00:00:00Z') },
            { product_id: 'p2', added_at: at('2026-10-03T00:00:00Z') },
            { product_id: 'hidden-new', added_at: at('2026-10-04T00:00:00Z') },
          ],
          ['hidden', 'hidden-new'],
          at('2026-10-26T00:00:00Z'),
        )
        expect(result).toEqual({ product_ids: ['p1', 'p2'], trimmed: false })
        // A product the shop hides for a while (draft) comes back when it is published again.
        expect(await service.listForCustomer('cus_1')).toEqual([
          { product_id: 'p1', added_at: at('2026-10-05T00:00:00Z') },
          { product_id: 'p2', added_at: at('2026-10-03T00:00:00Z') },
          { product_id: 'hidden', added_at: at('2026-10-02T00:00:00Z') },
        ])
      })

      it('at the limit hidden rows make room; visible ones still stop it', async () => {
        await service.createFavorites(
          Array.from({ length: FAVORITES_LIMIT }, (_, i) => ({
            customer_id: 'cus_1',
            product_id: `p${i}`,
            added_at: at('2026-10-01T00:00:00Z'),
          })),
        )
        expect(
          await service.addForCustomer('cus_1', 'nowy', at('2026-10-02T00:00:00Z'), ['p0', 'p1']),
        ).toBe('added')
        const ids = (await service.listForCustomer('cus_1')).map((e) => e.product_id)
        expect(ids).toHaveLength(FAVORITES_LIMIT - 1)
        expect(ids).not.toContain('p0')
        expect(ids).toContain('nowy')
        expect(await service.addForCustomer('cus_1', 'jeszcze', at('2026-10-03T00:00:00Z'))).toBe(
          'added',
        )
        expect(await service.addForCustomer('cus_1', 'za-duzo', at('2026-10-04T00:00:00Z'))).toBe(
          'limit',
        )
      })

      it('a failed merge leaves the old list (one transaction)', async () => {
        await service.addForCustomer('cus_1', 'p1', at('2026-10-01T00:00:00Z'))
        await service.addForCustomer('cus_1', 'gone', at('2026-10-02T00:00:00Z'))
        // The insert fails after the invisible row was deleted – both must roll back.
        await expect(
          service.mergeForCustomer(
            'cus_1',
            [{ product_id: 'p2', added_at: new Date('nie-data') }],
            ['gone'],
            at('2026-10-26T00:00:00Z'),
          ),
        ).rejects.toThrow()
        expect((await service.listForCustomer('cus_1')).map((e) => e.product_id).sort()).toEqual([
          'gone',
          'p1',
        ])
      })

      it('removes one, merges, prunes and removes all', async () => {
        await service.addForCustomer('cus_1', 'p1', at('2026-10-01T00:00:00Z'))
        await service.addForCustomer('cus_1', 'p2', at('2026-10-02T00:00:00Z'))
        await service.addForCustomer('cus_2', 'p1', at('2026-10-02T00:00:00Z'))

        await service.removeForCustomer('cus_1', 'p2')
        expect((await service.listForCustomer('cus_1')).map((e) => e.product_id)).toEqual(['p1'])

        await service.mergeForCustomer(
          'cus_1',
          [
            { product_id: 'p3', added_at: at('2026-10-05T00:00:00Z') },
            { product_id: 'p4', added_at: at('2026-10-04T00:00:00Z') },
          ],
          ['p1'],
          at('2026-10-26T00:00:00Z'),
        )
        // p1 is hidden now (e.g. a draft) – kept, not deleted.
        expect((await service.listForCustomer('cus_1')).map((e) => e.product_id)).toEqual([
          'p3',
          'p4',
          'p1',
        ])

        await service.pruneForCustomer('cus_1', ['p4'])
        expect((await service.listForCustomer('cus_1')).map((e) => e.product_id)).toEqual(['p4'])

        await service.removeAllForCustomer('cus_1')
        expect(await service.listForCustomer('cus_1')).toEqual([])
        expect(await service.listForCustomer('cus_2')).toHaveLength(1)
      })
    })
  },
})

// The `limit` option reaches the module the way a plugin's `options` do.
moduleIntegrationTestRunner<FavoriteModuleService>({
  moduleName: FAVORITE_MODULE,
  moduleModels: [Favorite],
  resolve: './src/modules/favorite',
  moduleOptions: { limit: 3, locale: 'en', messages: { productNotFound: 'Gone.' } },
  testSuite: ({ service }) => {
    describe('FavoriteModuleService with options', () => {
      it('gets the options, defaults filled in', () => {
        const options = service.getOptions()
        expect(options.limit).toBe(3)
        expect(options.locale).toBe('en')
        expect(options.messages.productNotFound).toBe('Gone.')
        expect(options.messages.limitReached).toContain('{limit}')
      })

      it('add stops at the limit option', async () => {
        for (const id of ['a', 'b', 'c'])
          expect(await service.addForCustomer('cus_1', id, at('2026-10-01T00:00:00Z'))).toBe(
            'added',
          )
        expect(await service.addForCustomer('cus_1', 'd', at('2026-10-02T00:00:00Z'))).toBe('limit')
      })

      it('merge keeps the newest entries up to the limit option', async () => {
        const result = await service.mergeForCustomer(
          'cus_1',
          ['a', 'b', 'c', 'd', 'e'].map((id, i) => ({
            product_id: id,
            added_at: new Date(Date.UTC(2026, 9, 1, 0, i)),
          })),
          [],
          at('2026-10-26T00:00:00Z'),
        )
        expect(result).toEqual({ product_ids: ['e', 'd', 'c'], trimmed: true })
      })
    })
  },
})

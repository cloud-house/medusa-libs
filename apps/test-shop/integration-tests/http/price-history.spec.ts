import {
  PRICE_HISTORY_MODULE,
  PRICE_HISTORY_RECORDED,
  type PriceHistoryModuleService,
  recordPriceSnapshotsWorkflow,
} from '@cloud-house/medusa-omnibus'
import recordPriceSnapshotsJob from '@cloud-house/medusa-omnibus/jobs/record-price-snapshots'
import type { MedusaContainer } from '@medusajs/framework/types'
import { ProductStatus } from '@medusajs/framework/utils'
import {
  createPriceListsWorkflow,
  updateProductVariantsWorkflow,
} from '@medusajs/medusa/core-flows'
import { medusaIntegrationTestRunner } from '@medusajs/test-utils'
import { createStore, type TestStore } from '../helpers/admin'
import { nextEvent } from '../helpers/events'
import { createTestProduct } from '../helpers/products'

jest.setTimeout(120 * 1000)

medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    describe('record-price-snapshots', () => {
      let container: MedusaContainer
      let store: TestStore
      let history: PriceHistoryModuleService

      const record = async () =>
        (await recordPriceSnapshotsWorkflow(container).run({ input: {} })).result

      beforeEach(async () => {
        container = getContainer()
        store = await createStore(container)
        history = container.resolve(PRICE_HISTORY_MODULE)
      })

      it('records current prices once and then only changes', async () => {
        const product = await createTestProduct(container, store.salesChannelId, {
          handle: 'wave',
          price: 2199,
        })
        const [variantId] = product.variantIds

        expect((await record()).recorded).toBe(1)
        expect((await record()).recorded).toBe(0)

        await updateProductVariantsWorkflow(container).run({
          input: {
            selector: { id: variantId },
            update: { prices: [{ currency_code: 'pln', amount: 1999 }] },
          },
        })
        const third = await record()

        expect(third).toEqual({ recorded: 1, variant_ids: [variantId] })
        const snapshots = await history.listPriceSnapshots(
          { variant_id: variantId },
          { order: { recorded_at: 'ASC' } },
        )
        expect(
          snapshots.map((s) => [s.amount, s.original_amount, s.region_id, s.currency_code]),
        ).toEqual([
          [2199, 2199, store.regionId, 'pln'],
          [1999, 1999, store.regionId, 'pln'],
        ])
      })

      it('captures the sale price from an active price list', async () => {
        const product = await createTestProduct(container, store.salesChannelId, {
          handle: 'wave',
          price: 2199,
        })
        const [variantId] = product.variantIds
        await createPriceListsWorkflow(container).run({
          input: {
            price_lists_data: [
              {
                title: 'Sale',
                description: 'Test',
                status: 'active',
                prices: [{ variant_id: variantId as string, amount: 1899, currency_code: 'pln' }],
              },
            ],
          },
        })

        await record()

        const [snapshot] = await history.listPriceSnapshots({ variant_id: variantId })
        expect(snapshot).toEqual(expect.objectContaining({ amount: 1899, original_amount: 2199 }))
      })

      it('skips variants without a price in the region and draft products', async () => {
        await createTestProduct(container, store.salesChannelId, {
          handle: 'no-price',
          price: null,
        })
        await createTestProduct(container, store.salesChannelId, {
          handle: 'draft',
          status: ProductStatus.DRAFT,
        })

        expect(await record()).toEqual({ recorded: 0, variant_ids: [] })
      })

      it('emits price-history.recorded with the recorded variants', async () => {
        const product = await createTestProduct(container, store.salesChannelId, {
          handle: 'wave',
          price: 2199,
        })
        const event = nextEvent(container, PRICE_HISTORY_RECORDED)

        await record()

        expect(PRICE_HISTORY_RECORDED).toBe('price-history.recorded')
        expect(await event).toEqual({ variant_ids: product.variantIds })
      })

      it('the job runs the workflow and logs with the plugin options', async () => {
        await createTestProduct(container, store.salesChannelId, { handle: 'wave', price: 2199 })
        expect(history.getOptions().logPrefix).toBe('Test')
        const logger = container.resolve('logger')
        const info = jest.spyOn(logger, 'info')

        await recordPriceSnapshotsJob(container)

        expect(await history.listPriceSnapshots()).toHaveLength(1)
        expect(info).toHaveBeenCalledWith('Test: zapisano 1 zmian cen w historii (Omnibus).')
      })
    })
  },
})

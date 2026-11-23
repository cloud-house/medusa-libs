import { moduleIntegrationTestRunner } from '@medusajs/test-utils'
import { FAKTUROWNIA_MODULE } from '..'
import { Invoice } from '../models/invoice'
import { InvoiceCorrection } from '../models/invoice-correction'
import type FakturowniaModuleService from '../service'

jest.setTimeout(60 * 1000)

moduleIntegrationTestRunner<FakturowniaModuleService>({
  moduleName: FAKTUROWNIA_MODULE,
  moduleModels: [Invoice, InvoiceCorrection],
  resolve: './src/modules/fakturownia',
  moduleOptions: {
    resolveOrder: async () => null,
    resolveReturnOrder: async () => null,
    resolveReturn: async () => null,
  },
  testSuite: ({ service }) => {
    describe('FakturowniaModuleService', () => {
      it('keeps one waiting row per order, also when two events race', async () => {
        const [first, second] = await Promise.all([
          service.ensureForOrder('order_1'),
          service.ensureForOrder('order_1'),
        ])

        expect(first.id).toBe(second.id)
        expect(first).toMatchObject({ order_id: 'order_1', status: 'waiting', ksef: 'none' })
        expect(await service.listInvoices({ order_id: 'order_1' })).toHaveLength(1)
      })

      it('gets the module options, defaults filled in', () => {
        expect(service.getOptions()).toMatchObject({
          oidPrefix: 'INV-',
          logPrefix: '[Fakturownia]',
        })
      })

      it('finds the row of an order and nothing for an unknown one', async () => {
        const row = await service.ensureForOrder('order_2')

        expect((await service.findByOrder('order_2'))?.id).toBe(row.id)
        expect(await service.findByOrder('order_unknown')).toBeNull()
      })

      it('keeps one waiting correction row per return, also when two passes race', async () => {
        const [first, second] = await Promise.all([
          service.ensureCorrectionForReturn('order_1', 'return_1'),
          service.ensureCorrectionForReturn('order_1', 'return_1'),
        ])

        expect(first.id).toBe(second.id)
        expect(first).toMatchObject({
          order_id: 'order_1',
          return_id: 'return_1',
          status: 'waiting',
          attention_reason: null,
          items: null,
          includes_shipping: false,
          attempts: 0,
          alerted_for: null,
        })
        expect(first.id).toMatch(/^invcor_/)
        expect(await service.listInvoiceCorrections({ return_id: 'return_1' })).toHaveLength(1)
        expect((await service.findCorrectionByReturn('return_1'))?.id).toBe(first.id)
        expect(await service.findCorrectionByReturn('return_unknown')).toBeNull()
      })

      it('lists the corrections of an order oldest first', async () => {
        const first = await service.ensureCorrectionForReturn('order_3', 'return_a')
        const second = await service.ensureCorrectionForReturn('order_3', 'return_b')
        await service.ensureCorrectionForReturn('order_4', 'return_c')
        // A later update must not change the order.
        await service.updateInvoiceCorrections({ id: first.id, status: 'issued' })

        const rows = await service.correctionsOfOrder('order_3')

        expect(rows.map((row) => row.id)).toEqual([first.id, second.id])
        expect(await service.correctionsOfOrder('order_unknown')).toEqual([])
      })
    })
  },
})

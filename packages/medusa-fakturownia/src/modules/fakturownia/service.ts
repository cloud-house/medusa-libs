import type { InferTypeOf } from '@medusajs/framework/types'
import { MedusaService } from '@medusajs/framework/utils'
import {
  type FakturowniaOptions,
  type ResolvedFakturowniaOptions,
  resolveOptions,
} from '../../options'
import { Invoice } from './models/invoice'
import { InvoiceCorrection } from './models/invoice-correction'

export type InvoiceRow = InferTypeOf<typeof Invoice>
export type CorrectionRow = InferTypeOf<typeof InvoiceCorrection>

/**
 * The invoices and credit notes of the shop's orders. Medusa hands a module its `options` as the
 * second constructor argument (a plugin's modules get the plugin's `options` from
 * `medusa-config.ts`) but passes nothing to subscribers, jobs or routes – those read them through
 * {@link FakturowniaModuleService.getOptions}.
 */
class FakturowniaModuleService extends MedusaService({ Invoice, InvoiceCorrection }) {
  protected readonly options_: ResolvedFakturowniaOptions

  // biome-ignore lint/suspicious/noExplicitAny: the container type of MedusaService
  constructor(_container: Record<string, any>, options?: FakturowniaOptions) {
    // biome-ignore lint/complexity/noArguments: MedusaService takes every constructor argument
    super(...arguments)
    this.options_ = resolveOptions(options as FakturowniaOptions)
  }

  /** The plugin options with the defaults filled in. */
  getOptions(): ResolvedFakturowniaOptions {
    return this.options_
  }

  async findByOrder(orderId: string): Promise<InvoiceRow | null> {
    const [row] = await this.listInvoices({ order_id: orderId }, { take: 1 })
    return (row as InvoiceRow | undefined) ?? null
  }

  /** The order's invoice row, created `waiting` the first time (spec 6c §5.2). */
  async ensureForOrder(orderId: string): Promise<InvoiceRow> {
    const existing = await this.findByOrder(orderId)
    if (existing) return existing
    try {
      return (await this.createInvoices({ order_id: orderId })) as InvoiceRow
    } catch (error) {
      // `order.placed` and `payment.captured` can arrive together – the unique index on
      // `order_id` refused the second insert, so the row is there.
      const row = await this.findByOrder(orderId)
      if (row) return row
      throw error
    }
  }

  async findCorrectionByReturn(returnId: string): Promise<CorrectionRow | null> {
    const [row] = await this.listInvoiceCorrections({ return_id: returnId }, { take: 1 })
    return (row as CorrectionRow | undefined) ?? null
  }

  /** The return's correction row, created `waiting` the first time (spec 6e-b, D3). */
  async ensureCorrectionForReturn(orderId: string, returnId: string): Promise<CorrectionRow> {
    const existing = await this.findCorrectionByReturn(returnId)
    if (existing) return existing
    try {
      return (await this.createInvoiceCorrections({
        order_id: orderId,
        return_id: returnId,
      })) as CorrectionRow
    } catch (error) {
      // The event and the job can meet – the unique index on `return_id` refused the second
      // insert, so the row is there.
      const row = await this.findCorrectionByReturn(returnId)
      if (row) return row
      throw error
    }
  }

  /** All correction rows of the order, oldest first. */
  async correctionsOfOrder(orderId: string): Promise<CorrectionRow[]> {
    return (await this.listInvoiceCorrections(
      { order_id: orderId },
      { order: { created_at: 'ASC', id: 'ASC' }, take: null },
    )) as CorrectionRow[]
  }
}

export default FakturowniaModuleService

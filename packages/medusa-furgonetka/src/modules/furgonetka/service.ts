import type { Context, InferTypeOf } from '@medusajs/framework/types'
import {
  InjectTransactionManager,
  MedusaContext,
  MedusaError,
  MedusaService,
} from '@medusajs/framework/utils'
import {
  type FurgonetkaOptions,
  type ResolvedFurgonetkaOptions,
  resolveOptions,
} from '../../options'
import type { TemplateKind, TemplatePurpose } from '../../types'
import { FurgonetkaConnection } from './models/connection'
import { ParcelTemplate } from './models/parcel-template'
import { Shipment } from './models/shipment'

export type ShipmentRow = InferTypeOf<typeof Shipment>
export type TemplateRow = InferTypeOf<typeof ParcelTemplate>
export type ConnectionRow = InferTypeOf<typeof FurgonetkaConnection>

export interface TemplateInput {
  id?: string
  name: string
  kind: TemplateKind
  length_cm: number
  width_cm: number
  height_cm: number
  weight_g: number
  purpose: TemplatePurpose | null
}

const NEWEST_FIRST = { created_at: 'DESC', id: 'DESC' } as const

/**
 * Shipments, parcel templates and the Furgonetka connection. Medusa hands a module its `options` as
 * the second constructor argument (a plugin's modules get the plugin's `options` from
 * `medusa-config.ts`) but passes nothing to subscribers, jobs or routes – those read them through
 * {@link FurgonetkaModuleService.getOptions}.
 */
class FurgonetkaModuleService extends MedusaService({
  Shipment,
  ParcelTemplate,
  FurgonetkaConnection,
}) {
  protected readonly options_: ResolvedFurgonetkaOptions

  // biome-ignore lint/suspicious/noExplicitAny: the container type of MedusaService
  constructor(_container: Record<string, any>, options?: FurgonetkaOptions) {
    // biome-ignore lint/complexity/noArguments: MedusaService takes every constructor argument
    super(...arguments)
    this.options_ = resolveOptions(options as FurgonetkaOptions)
  }

  /** The plugin options with the defaults filled in. */
  getOptions(): ResolvedFurgonetkaOptions {
    return this.options_
  }

  /** The order's shipment that is not canceled (the unique index allows only one). */
  async activeShipment(orderId: string): Promise<ShipmentRow | null> {
    const [row] = await this.listShipments(
      { order_id: orderId, state: { $ne: 'canceled' } },
      { order: NEWEST_FIRST, take: 1 },
    )
    return (row as ShipmentRow | undefined) ?? null
  }

  /** The order's newest shipment of any state. */
  async latestShipment(orderId: string): Promise<ShipmentRow | null> {
    const [row] = await this.listShipments({ order_id: orderId }, { order: NEWEST_FIRST, take: 1 })
    return (row as ShipmentRow | undefined) ?? null
  }

  /** The shipment that created a fulfillment; the newest row if a canceled one shares its id. */
  async shipmentByFulfillment(fulfillmentId: string): Promise<ShipmentRow | null> {
    const [row] = await this.listShipments(
      { fulfillment_id: fulfillmentId },
      { order: NEWEST_FIRST, take: 1 },
    )
    return (row as ShipmentRow | undefined) ?? null
  }

  /** The shop's connection to Furgonetka – the only row, `null` before the first connect. */
  async connection(): Promise<ConnectionRow | null> {
    const [row] = await this.listFurgonetkaConnections({}, { order: NEWEST_FIRST, take: 1 })
    return (row as ConnectionRow | undefined) ?? null
  }

  /**
   * Creates a template (no `id`) or updates one. A purpose is taken off its previous owner in the
   * same transaction. Every purpose must keep a template, so a template that has a purpose cannot
   * lose it – give the purpose to another template first (spec 6d §5.3).
   */
  @InjectTransactionManager()
  async saveTemplate(
    input: TemplateInput,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<TemplateRow> {
    const { id, ...values } = input
    const current = id ? await this.retrieveParcelTemplate(id, {}, sharedContext) : null
    if (current?.purpose && current.purpose !== values.purpose) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        'Każde przeznaczenie musi mieć szablon – przypisz je najpierw innemu szablonowi.',
      )
    }
    if (values.purpose && current?.purpose !== values.purpose) {
      const [owner] = await this.listParcelTemplates(
        { purpose: values.purpose },
        { take: 1 },
        sharedContext,
      )
      if (owner) {
        await this.updateParcelTemplates({ id: owner.id, purpose: null }, sharedContext)
        // Writes reach the database at the end of the transaction, inserts before updates. The
        // unique index on `purpose` needs the old owner cleared first, so write it out now.
        await (sharedContext.transactionManager as { flush(): Promise<void> }).flush()
      }
    }
    const saved = current
      ? await this.updateParcelTemplates({ id: current.id, ...values }, sharedContext)
      : await this.createParcelTemplates(values, sharedContext)
    return saved as TemplateRow
  }

  /** Deletes a template; one that has a purpose stays (spec 6d §5.3). */
  async removeTemplate(id: string): Promise<void> {
    const template = await this.retrieveParcelTemplate(id)
    if (template.purpose) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        'Szablonu z przeznaczeniem nie można usunąć – przypisz przeznaczenie innemu szablonowi.',
      )
    }
    await this.deleteParcelTemplates(id)
  }
}

export default FurgonetkaModuleService

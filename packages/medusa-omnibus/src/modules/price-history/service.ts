import type { PriceSnapshotPoint } from '@cloud-house/commerce-rules'
import type { InferTypeOf } from '@medusajs/framework/types'
import { MedusaService } from '@medusajs/framework/utils'
import { type OmnibusOptions, type ResolvedOmnibusOptions, resolveOptions } from '../../options'
import { PriceSnapshot } from './models/price-snapshot'

export type PriceSnapshotDTO = InferTypeOf<typeof PriceSnapshot>

class PriceHistoryModuleService extends MedusaService({ PriceSnapshot }) {
  protected readonly options_: ResolvedOmnibusOptions

  /**
   * Medusa hands a module its `options` as the second argument; a plugin's modules get the
   * plugin's `options` from `medusa-config.ts`. The job reads them through {@link getOptions}.
   */
  // biome-ignore lint/suspicious/noExplicitAny: the container type of MedusaService
  constructor(_container: Record<string, any>, options?: OmnibusOptions) {
    // biome-ignore lint/complexity/noArguments: MedusaService takes every constructor argument
    super(...arguments)
    this.options_ = resolveOptions(options)
  }

  /** The plugin options with the defaults filled in and the texts merged. */
  getOptions(): ResolvedOmnibusOptions {
    return this.options_
  }

  /** All snapshots of the variants in the region, oldest first, grouped by variant. */
  async listHistoryByVariant(
    variantIds: string[],
    regionId: string,
  ): Promise<Map<string, PriceSnapshotPoint[]>> {
    const history = new Map<string, PriceSnapshotPoint[]>()
    if (variantIds.length === 0) return history
    const rows = await this.listPriceSnapshots(
      { variant_id: variantIds, region_id: regionId },
      { order: { recorded_at: 'ASC' } },
    )
    for (const row of rows) {
      const points = history.get(row.variant_id) ?? []
      points.push({
        amount: Number(row.amount),
        original_amount: Number(row.original_amount),
        recorded_at: row.recorded_at,
      })
      history.set(row.variant_id, points)
    }
    return history
  }

  /** The newest snapshot of each variant in the region. */
  async listLatestByVariant(
    variantIds: string[],
    regionId: string,
  ): Promise<Map<string, PriceSnapshotDTO>> {
    const latest = new Map<string, PriceSnapshotDTO>()
    if (variantIds.length === 0) return latest
    const rows = await this.listPriceSnapshots(
      { variant_id: variantIds, region_id: regionId },
      { order: { recorded_at: 'DESC' } },
    )
    for (const row of rows) if (!latest.has(row.variant_id)) latest.set(row.variant_id, row)
    return latest
  }
}

export default PriceHistoryModuleService

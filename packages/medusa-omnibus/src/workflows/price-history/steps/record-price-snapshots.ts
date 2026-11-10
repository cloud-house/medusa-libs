import { ContainerRegistrationKeys, Modules, QueryContext } from '@medusajs/framework/utils'
import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk'
import { PRICE_HISTORY_MODULE } from '../../../modules/price-history'
import type PriceHistoryModuleService from '../../../modules/price-history/service'
import { type CurrentVariantPrice, planPriceSnapshots } from '../plan-snapshots'

type CalculatedPrice = { calculated_amount?: number | null; original_amount?: number | null } | null

export const recordPriceSnapshotsStep = createStep(
  'record-price-snapshots',
  async (input: { now?: string }, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const history: PriceHistoryModuleService = container.resolve(PRICE_HISTORY_MODULE)
    const regions = await container
      .resolve(Modules.REGION)
      .listRegions({}, { select: ['id', 'currency_code'] })
    const recordedAt = input.now ? new Date(input.now) : new Date()

    const createdIds: string[] = []
    const variantIds: string[] = []
    for (const region of regions) {
      const { data: products } = await query.graph({
        entity: 'product',
        fields: ['id', 'variants.id', 'variants.calculated_price.*'],
        filters: { status: 'published' },
        context: {
          variants: {
            calculated_price: QueryContext({
              region_id: region.id,
              currency_code: region.currency_code,
            }),
          },
        },
      })
      const current: CurrentVariantPrice[] = products.flatMap((product) =>
        (product.variants ?? []).flatMap((variant) => {
          const price = (variant as { calculated_price?: CalculatedPrice } | null)?.calculated_price
          if (!variant || price?.calculated_amount == null) return []
          return [
            {
              variant_id: variant.id,
              amount: Number(price.calculated_amount),
              original_amount: Number(price.original_amount ?? price.calculated_amount),
            },
          ]
        }),
      )
      const latest = await history.listLatestByVariant(
        current.map((price) => price.variant_id),
        region.id,
      )
      const planned = planPriceSnapshots(
        current,
        new Map(
          [...latest].map(([id, s]) => [
            id,
            { amount: Number(s.amount), original_amount: Number(s.original_amount) },
          ]),
        ),
        { region_id: region.id, currency_code: region.currency_code, recorded_at: recordedAt },
      )
      if (planned.length > 0) {
        const created = await history.createPriceSnapshots(planned)
        createdIds.push(...created.map((snapshot) => snapshot.id))
        variantIds.push(...planned.map((snapshot) => snapshot.variant_id))
      }
    }

    return new StepResponse(
      { recorded: createdIds.length, variant_ids: [...new Set(variantIds)] },
      createdIds,
    )
  },
  async (createdIds, { container }) => {
    if (!createdIds?.length) return
    const history: PriceHistoryModuleService = container.resolve(PRICE_HISTORY_MODULE)
    await history.deletePriceSnapshots(createdIds)
  },
)

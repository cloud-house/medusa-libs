import { model } from '@medusajs/framework/utils'

/** A variant's calculated (gross) and regular price in a region from `recorded_at` on. Insert-only. */
export const PriceSnapshot = model
  .define('price_snapshot', {
    id: model.id().primaryKey(),
    variant_id: model.text(),
    region_id: model.text(),
    currency_code: model.text(),
    amount: model.float(),
    original_amount: model.float(),
    recorded_at: model.dateTime(),
  })
  .indexes([{ on: ['variant_id', 'region_id', 'recorded_at'] }])

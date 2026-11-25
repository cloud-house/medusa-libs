import { model } from '@medusajs/framework/utils'

/**
 * A parcel template (spec 6d §5.3). Dimensions in whole cm, weight in grams. A `purpose` is the
 * default use of the template and belongs to at most one template (the unique index); the service
 * keeps every purpose assigned.
 */
export const ParcelTemplate = model
  .define('parcel_template', {
    id: model.id({ prefix: 'ptpl' }).primaryKey(),
    name: model.text(),
    kind: model.enum(['locker_a', 'locker_b', 'locker_c', 'box']),
    length_cm: model.number(),
    width_cm: model.number(),
    height_cm: model.number(),
    weight_g: model.number(),
    // The key of a parcel class or `accessories_locker` / `accessories_courier` (kit step 4c: free text).
    purpose: model.text().nullable(),
  })
  .indexes([{ on: ['purpose'], unique: true, where: 'purpose IS NOT NULL AND deleted_at IS NULL' }])

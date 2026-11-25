import { model } from '@medusajs/framework/utils'

/** Current handle of a Medusa product, category or brand – compared on every update event. */
export const CatalogHandle = model
  .define('catalog_handle', {
    id: model.id({ prefix: 'chdl' }).primaryKey(),
    kind: model.enum(['product', 'category', 'brand']),
    entity_id: model.text(),
    handle: model.text(),
  })
  .indexes([{ on: ['kind', 'entity_id'], unique: true, where: 'deleted_at IS NULL' }])

/** Old address of a renamed product, category or brand – the shop answers it with 308. */
export const HandleRedirect = model
  .define('handle_redirect', {
    id: model.id({ prefix: 'hred' }).primaryKey(),
    kind: model.enum(['product', 'category', 'brand']),
    old_handle: model.text(),
    entity_id: model.text(),
  })
  .indexes([{ on: ['kind', 'old_handle'] }])

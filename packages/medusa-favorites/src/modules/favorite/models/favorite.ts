import { model } from '@medusajs/framework/utils'

/** A product a customer put on their favourites list. One row per customer and product. */
export const Favorite = model
  .define('favorite', {
    id: model.id({ prefix: 'fav' }).primaryKey(),
    customer_id: model.text(),
    product_id: model.text(),
    added_at: model.dateTime(),
  })
  .indexes([{ on: ['customer_id', 'product_id'], unique: true }])

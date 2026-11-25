import { model } from '@medusajs/framework/utils'

/**
 * What an entry points at (media, products, categories, other entries), rebuilt on every save from
 * its JSON and Lexical content. Guards deletes („in use”) and finds the articles of a product.
 */
export const ContentRef = model
  .define('content_ref', {
    id: model.id({ prefix: 'cntr' }).primaryKey(),
    entry_id: model.text(),
    /** `published` – from `data`; `draft` – from the working copy. */
    state: model.enum(['published', 'draft']),
    target_type: model.enum(['media', 'product', 'category', 'brand', 'entry']),
    target_id: model.text(),
  })
  .indexes([{ on: ['entry_id'] }, { on: ['target_type', 'target_id'] }])

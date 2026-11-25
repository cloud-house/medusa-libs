import { model } from '@medusajs/framework/utils'

/**
 * History of an entry: every publication and the rolling autosave of the working copy. Published
 * versions of info pages are kept forever – proof of which Regulamin applied on a given day.
 */
export const ContentVersion = model
  .define('content_version', {
    id: model.id({ prefix: 'cntv' }).primaryKey(),
    entry_id: model.text(),
    snapshot: model.json(),
    status: model.enum(['draft', 'published']),
    autosave: model.boolean().default(false),
    created_by: model.text().nullable(),
  })
  .indexes([{ on: ['entry_id', 'created_at'] }])

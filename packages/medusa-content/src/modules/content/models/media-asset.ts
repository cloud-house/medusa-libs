import { model } from '@medusajs/framework/utils'

/** Image or PDF uploaded through the File module (S3), with the editor's description. */
export const MediaAsset = model
  .define('media_asset', {
    id: model.id({ prefix: 'med' }).primaryKey(),
    kind: model.enum(['image', 'document']),
    file_id: model.text(),
    url: model.text(),
    filename: model.text(),
    mime_type: model.text(),
    filesize: model.number(),
    width: model.number().nullable(),
    height: model.number().nullable(),
    /** Image: alternative text; PDF: title shown in the list of downloads. */
    alt: model.text().default(''),
    credit: model.text().nullable(),
    credit_url: model.text().nullable(),
  })
  .indexes([{ on: ['kind'] }])

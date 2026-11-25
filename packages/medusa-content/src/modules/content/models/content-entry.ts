import { model } from '@medusajs/framework/utils'

/**
 * Every editorial document is one entry of a registered kind: info pages, articles and categories,
 * content of Medusa products, categories and brands, and the globals (header, footer, home page…). Fields
 * live in `data` in the shape the shop's view mappers read (validated with zod per `type`).
 *
 * - `data` – the published state (or the only state for types without drafts),
 * - `draft` – the working copy of types with drafts; `null` = nothing unpublished.
 */
export const ContentEntry = model
  .define('content_entry', {
    id: model.id({ prefix: 'cnt' }).primaryKey(),
    /** Key of the registered kind (`page`, `article`, `global`, a shop's own…); `global` rows use `slug` as the key. */
    type: model.text(),
    /** Address of a page, article or article category; key of a global (`home-page`…). */
    slug: model.text().nullable(),
    /** Medusa id of the product, category or brand the content belongs to. */
    entity_id: model.text().nullable(),
    status: model.enum(['draft', 'published']).default('draft'),
    data: model.json().nullable(),
    draft: model.json().nullable(),
    /** First publication (articles show it as the date). */
    published_at: model.dateTime().nullable(),
    /** Latest publication – `dateModified` and sitemap dates (autosaved drafts do not touch it). */
    last_published_at: model.dateTime().nullable(),
    updated_by: model.text().nullable(),
  })
  .indexes([
    { on: ['type', 'slug'], unique: true, where: 'slug IS NOT NULL AND deleted_at IS NULL' },
    {
      on: ['type', 'entity_id'],
      unique: true,
      where: 'entity_id IS NOT NULL AND deleted_at IS NULL',
    },
  ])

/**
 * Events the workflows emit. Medusa's own events of the module are named `brand.brand.*` (so these
 * `brand.*` do not clash) and carry only the id; these carry the handles:
 * - `created`: `{ id, handle }`
 * - `updated`: `{ id, handle, previous_handle? }` (`previous_handle` only when the handle changed)
 * - `deleted`: `{ id, handle }`
 * - `productBrandUpdated`: `{ product_id, brand_id, previous_brand_id }` (`null` for no brand)
 */
export const BRAND_EVENTS = {
  created: 'brand.created',
  updated: 'brand.updated',
  deleted: 'brand.deleted',
  productBrandUpdated: 'product-brand.updated',
} as const

export type BrandEvent = (typeof BRAND_EVENTS)[keyof typeof BRAND_EVENTS]

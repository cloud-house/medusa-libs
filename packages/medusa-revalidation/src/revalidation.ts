import {
  brandTag,
  categoryTag,
  isKitTagAllowed,
  KIT_TAGS,
  productTag,
} from '@cloud-house/commerce-rules'
import {
  type RevalidationLocale,
  type RevalidationMessages,
  resolveRevalidationMessages,
} from './messages'

/** A hanging storefront must not park the subscriber for undici's default five minutes. */
export const REVALIDATE_TIMEOUT_MS = 10_000

/** Medusa events that change what the storefront shows. Shops add their own to this list. */
export const DEFAULT_REVALIDATION_EVENTS: string[] = [
  'product.created',
  'product.updated',
  'product.deleted',
  'product-variant.created',
  'product-variant.updated',
  'product-variant.deleted',
  'product-category.created',
  'product-category.updated',
  'product-category.deleted',
  'inventory-level.created',
  'inventory-level.updated',
  'inventory-level.deleted',
  'reservation-item.created',
  'reservation-item.updated',
  'reservation-item.deleted',
  // Service events of the Pricing module (price lists and prices edited in the admin).
  'pricing.price-list.created',
  'pricing.price-list.updated',
  'pricing.price-list.deleted',
  'pricing.price.created',
  'pricing.price.updated',
  'pricing.price.deleted',
  // Brand events (emitted by a brands module; matched by name only).
  'brand.created',
  'brand.updated',
  'brand.deleted',
  'product-brand.updated',
  // Service events of the Promotion module (`{module}.{model}.{action}`).
  ...['promotion', 'application-method', 'promotion-rule', 'campaign'].flatMap((model) =>
    ['created', 'updated', 'deleted'].map((action) => `promotion.${model}.${action}`),
  ),
]

export interface TagLookup {
  productHandle(id: string): Promise<string | null>
  categoryHandle(id: string): Promise<string | null>
}

const CATALOG = KIT_TAGS.catalog
const str = (value: unknown) => (typeof value === 'string' && value ? value : null)

async function withProduct(id: string | null, lookup: TagLookup): Promise<string[]> {
  const handle = id ? await lookup.productHandle(id) : null
  return handle ? [CATALOG, productTag(handle)] : [CATALOG]
}

/**
 * Cache tags of a default event, or `null` when the event is not one of the kit's (the shop
 * decides what to purge for it).
 */
export async function defaultTagsForEvent(
  name: string,
  data: Record<string, unknown>,
  lookup: TagLookup,
): Promise<string[] | null> {
  if (!DEFAULT_REVALIDATION_EVENTS.includes(name)) return null
  if (name === 'product-brand.updated' && data.brand_id === data.previous_brand_id) return []
  if (name.startsWith('promotion.')) return [KIT_TAGS.promotions]
  if (name.startsWith('product.')) return withProduct(str(data.id), lookup)
  if (name === 'product-brand.updated') return withProduct(str(data.product_id), lookup)
  if (name.startsWith('product-category.')) {
    const id = str(data.id)
    const handle = id ? await lookup.categoryHandle(id) : null
    return handle ? [CATALOG, categoryTag(handle)] : [CATALOG]
  }
  if (name.startsWith('brand.')) {
    const handles = [str(data.handle), str(data.previous_handle)].filter((h): h is string =>
      Boolean(h),
    )
    return [CATALOG, ...handles.map(brandTag)]
  }
  return [CATALOG]
}

export interface PostRevalidateOptions {
  url: string
  secret: string
  /** Secret header the storefront webhook checks. Default `x-revalidate-secret`. */
  header?: string
  /** Tags the storefront would accept. Default `isKitTagAllowed`. */
  isAllowedTag?: (tag: string) => boolean
  fetch?: typeof globalThis.fetch
  logger: { warn(message: string): void }
  /** Prefix of log lines. Default `Revalidation`. */
  logPrefix?: string
  /** Language of the log lines. Default `'en'`. */
  locale?: RevalidationLocale
  /** Single log texts over the `locale` dictionary. */
  messages?: Partial<RevalidationMessages>
}

/** POSTs the tags to the storefront webhook. Never throws – a failed purge only logs a warning. */
export async function postRevalidate(
  tags: string[],
  options: PostRevalidateOptions,
): Promise<boolean> {
  const isAllowed = options.isAllowedTag ?? isKitTagAllowed
  const prefix = options.logPrefix ?? 'Revalidation'
  const texts = resolveRevalidationMessages(options.locale, options.messages)
  // The webhook rejects a whole batch with one bad tag – drop it here so the rest still purges.
  const allowed = tags.filter(isAllowed)
  if (allowed.length < tags.length) {
    const rejected = tags.filter((tag) => !isAllowed(tag))
    options.logger.warn(`${prefix}: ${texts.skippedTags(rejected)}`)
  }
  if (allowed.length === 0) return true
  const doFetch = options.fetch ?? globalThis.fetch
  try {
    const response = await doFetch(`${options.url.replace(/\/+$/, '')}/api/revalidate`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [options.header ?? 'x-revalidate-secret']: options.secret,
      },
      body: JSON.stringify({ tags: allowed }),
      signal: AbortSignal.timeout(REVALIDATE_TIMEOUT_MS),
    })
    if (response.ok) return true
    options.logger.warn(`${prefix}: ${texts.rejected(response.status, allowed)}`)
  } catch (error) {
    options.logger.warn(`${prefix}: ${texts.failed(allowed, error)}`)
  }
  return false
}

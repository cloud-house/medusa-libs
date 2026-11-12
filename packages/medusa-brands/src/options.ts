import {
  BRAND_LOCALES,
  type BrandLocale,
  type BrandMessages,
  resolveMessages,
  withoutUndefined,
} from './messages'

/** `plugins: [{ resolve: '@cloud-house/medusa-brands', options }]` in `medusa-config.ts`. */
export interface BrandsOptions {
  /** Dictionary of the texts; default `'pl'`. */
  locale?: BrandLocale
  /** Single texts over the `locale` dictionary. */
  messages?: Partial<BrandMessages>
  /**
   * Whether the plugin serves `GET /store/brands` (brands with the number of published products
   * in the publishable key's sales channels); default `true`. `false`: the route stays
   * registered but hands the request on (`next()`), so the answer is the 404 of an unknown path.
   * A route file of the shop at the same path replaces the plugin's route whatever this says; to
   * reuse the handler there, export {@link brandsStoreRoute}.
   */
  storeRoute?: boolean
  /**
   * Show a "details" button per brand in the admin list, linking to `/brands/:id`; default
   * `false`. The page itself is the shop's (an admin route of the shop at that path).
   */
  adminDetailLinks?: boolean
}

export interface ResolvedBrandsOptions {
  locale: BrandLocale
  messages: BrandMessages
  storeRoute: boolean
  adminDetailLinks: boolean
}

/** Options with the defaults filled in (`undefined` values count as unset); throws on an unknown locale. */
export function resolveOptions(options: BrandsOptions = {}): ResolvedBrandsOptions {
  const {
    locale = 'pl',
    storeRoute = true,
    adminDetailLinks = false,
    messages,
  } = withoutUndefined(options)
  if (!BRAND_LOCALES.includes(locale))
    throw new Error(
      `@cloud-house/medusa-brands: unknown locale "${locale}" (use ${BRAND_LOCALES.join(', ')}).`,
    )
  return { locale, messages: resolveMessages(locale, messages), storeRoute, adminDetailLinks }
}

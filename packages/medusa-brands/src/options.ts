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
   * in the publishable key's sales channels); default `true`. `false`: the plugin does not
   * register the route, so a shop can mount its own (or {@link brandsStoreRoute}) at that path.
   */
  storeRoute?: boolean
}

export interface ResolvedBrandsOptions {
  locale: BrandLocale
  messages: BrandMessages
  storeRoute: boolean
}

/** Options with the defaults filled in (`undefined` values count as unset); throws on an unknown locale. */
export function resolveOptions(options: BrandsOptions = {}): ResolvedBrandsOptions {
  const { locale = 'pl', storeRoute = true, messages } = withoutUndefined(options)
  if (!BRAND_LOCALES.includes(locale))
    throw new Error(
      `@cloud-house/medusa-brands: unknown locale "${locale}" (use ${BRAND_LOCALES.join(', ')}).`,
    )
  return { locale, messages: resolveMessages(locale, messages), storeRoute }
}

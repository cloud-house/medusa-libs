import {
  FAVORITES_LOCALES,
  type FavoritesLocale,
  type FavoritesMessages,
  resolveMessages,
  withoutUndefined,
} from './messages'

/** Most favourites one list keeps unless the `limit` option says otherwise. */
export const DEFAULT_FAVORITES_LIMIT = 100

/** `plugins: [{ resolve: '@cloud-house/medusa-favorites', options }]` in `medusa-config.ts`. */
export interface FavoritesOptions {
  /** Most visible favourites per customer (a positive integer); default 100. */
  limit?: number
  /** Dictionary of the API error texts; default `'pl'`. */
  locale?: FavoritesLocale
  /** Single texts over the `locale` dictionary. */
  messages?: Partial<FavoritesMessages>
}

export interface ResolvedFavoritesOptions {
  limit: number
  locale: FavoritesLocale
  messages: FavoritesMessages
}

/** Options with the defaults filled in (`undefined` values count as unset); throws on an invalid value. */
export function resolveOptions(options: FavoritesOptions = {}): ResolvedFavoritesOptions {
  const { limit = DEFAULT_FAVORITES_LIMIT, locale = 'pl', messages } = withoutUndefined(options)
  if (!Number.isInteger(limit) || limit < 1)
    throw new Error(
      `@cloud-house/medusa-favorites: limit must be a positive integer (got ${limit}).`,
    )
  if (!FAVORITES_LOCALES.includes(locale))
    throw new Error(
      `@cloud-house/medusa-favorites: unknown locale "${locale}" (use ${FAVORITES_LOCALES.join(', ')}).`,
    )
  return { limit, locale, messages: resolveMessages(locale, messages) }
}

/** The "list is full" text with the `limit` option put in. */
export const formatLimitMessage = (options: ResolvedFavoritesOptions): string =>
  options.messages.limitReached.replaceAll('{limit}', String(options.limit))

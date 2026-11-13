import { pluralize, pluralizePl } from '@cloud-house/commerce-rules'
import {
  FAVORITES_LOCALES,
  FAVORITES_NOUNS,
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

/** The noun after a number of favourites, in the form the locale needs. */
export const favoritesNoun = (count: number, locale: FavoritesLocale): string =>
  locale === 'pl'
    ? pluralizePl(count, FAVORITES_NOUNS.pl)
    : pluralize(count, { one: FAVORITES_NOUNS.en[0], other: FAVORITES_NOUNS.en[1] }, { locale })

/** The "list is full" text with the `limit` option and its noun put in. */
export const formatLimitMessage = (options: ResolvedFavoritesOptions): string =>
  options.messages.limitReached
    .replaceAll('{limit}', String(options.limit))
    .replaceAll('{favorites}', favoritesNoun(options.limit, options.locale))

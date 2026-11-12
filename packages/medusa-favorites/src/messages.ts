/**
 * Every text the plugin returns in API errors. `{limit}` is filled in with the `limit` option
 * where the text is used (see `formatLimitMessage`).
 */
export interface FavoritesMessages {
  /** 404 `product_not_found`. */
  productNotFound: string
  /** 400 `favorites_limit_reached`; `{limit}`. */
  limitReached: string
}

export type FavoritesLocale = 'pl' | 'en'

export const FAVORITES_LOCALES: readonly FavoritesLocale[] = ['pl', 'en']

export const messages: Record<FavoritesLocale, FavoritesMessages> = {
  pl: {
    productNotFound: 'Nie znaleziono produktu.',
    limitReached: 'Masz już {limit} ulubionych – usuń któryś, żeby dodać nowy.',
  },
  en: {
    productNotFound: 'Product not found.',
    limitReached: 'You already have {limit} favourites – remove one to add a new one.',
  },
}

/** `values` without the keys set to `undefined` (a spread would let them wipe a default). */
export const withoutUndefined = <T extends object>(values: T | undefined): Partial<T> =>
  Object.fromEntries(
    Object.entries(values ?? {}).filter(([, value]) => value !== undefined),
  ) as Partial<T>

/** The `locale` dictionary with `overrides` on top (`undefined` ones ignored). */
export function resolveMessages(
  locale: FavoritesLocale,
  overrides: Partial<FavoritesMessages> = {},
): FavoritesMessages {
  return { ...messages[locale], ...withoutUndefined(overrides) }
}

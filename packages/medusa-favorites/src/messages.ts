/**
 * Every text the plugin returns in API errors. In `limitReached`, `{limit}` is filled in with the
 * `limit` option and `{favorites}` with the noun in the right form for it (ulubiony / ulubione /
 * ulubionych; favourite / favourites). A text of your own may use both, one or none (see
 * `formatLimitMessage`).
 */
export interface FavoritesMessages {
  /** 404 `favorites_product_not_found`. */
  productNotFound: string
  /** 400 `favorites_limit_reached`; `{limit}`, `{favorites}`. */
  limitReached: string
}

export type FavoritesLocale = 'pl' | 'en'

/** The noun counted by `limit`: [1, 2–4 (not 12–14), the rest] in Polish, [1, the rest] in English. */
export const FAVORITES_NOUNS = {
  pl: ['ulubiony', 'ulubione', 'ulubionych'],
  en: ['favourite', 'favourites'],
} as const

export const FAVORITES_LOCALES: readonly FavoritesLocale[] = ['pl', 'en']

export const messages: Record<FavoritesLocale, FavoritesMessages> = {
  pl: {
    productNotFound: 'Nie znaleziono produktu.',
    limitReached: 'Masz już {limit} {favorites} – usuń któryś, żeby dodać nowy.',
  },
  en: {
    productNotFound: 'Product not found.',
    limitReached: 'You already have {limit} {favorites} – remove one to add a new one.',
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

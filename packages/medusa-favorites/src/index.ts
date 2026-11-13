export { FAVORITES_ERROR_CODES, type FavoritesErrorCode } from './errors'
export { type FavoriteEntry, mergeFavorites } from './lib/favorites'
export type { FavoritesResponse } from './lib/types'
export { visibleProductIds } from './lib/visible-products'
export {
  FAVORITES_LOCALES,
  FAVORITES_NOUNS,
  type FavoritesLocale,
  type FavoritesMessages,
  messages,
  resolveMessages,
} from './messages'
export { FAVORITE_MODULE } from './modules/favorite'
export type { default as FavoriteModuleService } from './modules/favorite/service'
export {
  DEFAULT_FAVORITES_LIMIT,
  type FavoritesOptions,
  favoritesNoun,
  formatLimitMessage,
  type ResolvedFavoritesOptions,
  resolveOptions,
} from './options'

/** Stable `code` of the plugin's API errors – the storefront can translate them its own way. */
export const FAVORITES_ERROR_CODES = {
  /** 400 – the list already has `limit` visible products. */
  limitReached: 'favorites_limit_reached',
  /** 404 – the product does not exist, is not published or is outside the sales channel. */
  productNotFound: 'product_not_found',
} as const

export type FavoritesErrorCode = (typeof FAVORITES_ERROR_CODES)[keyof typeof FAVORITES_ERROR_CODES]

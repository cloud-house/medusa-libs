/** Stable `code` of the plugin's API errors – the storefront or panel can translate them their own way. */
export const BRAND_ERROR_CODES = {
  /** 422 – another brand already has this handle. */
  handleTaken: 'brand_handle_taken',
  /** 400 – the handle is not lower-case words joined by single hyphens. */
  handleInvalid: 'brand_handle_invalid',
  /** 400 – no handle can be made from the name; give one by hand. */
  handleUnderivable: 'brand_handle_underivable',
  /** 400 – the name is empty or too long. */
  nameInvalid: 'brand_name_invalid',
  /** 404 – the product does not exist. */
  productNotFound: 'brand_product_not_found',
} as const

export type BrandErrorCode = (typeof BRAND_ERROR_CODES)[keyof typeof BRAND_ERROR_CODES]

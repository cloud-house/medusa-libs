/** Stable `code` of the errors the plugin itself throws; it is the prefix of the message in brackets. */
export const CHECKOUT_PL_ERROR_CODES = {
  /** A required plugin option is missing (thrown at start-up). */
  missingOption: 'checkout_pl_missing_option',
  /** A plugin option has a value the plugin cannot use (thrown at start-up). */
  invalidOption: 'checkout_pl_invalid_option',
} as const

export type CheckoutPlErrorCode =
  (typeof CHECKOUT_PL_ERROR_CODES)[keyof typeof CHECKOUT_PL_ERROR_CODES]

/** An error of the plugin's own: the code in brackets, then what to do about it. */
export function checkoutPlError(code: CheckoutPlErrorCode, message: string): Error {
  return new Error(`@cloud-house/medusa-checkout-pl [${code}]: ${message}`)
}

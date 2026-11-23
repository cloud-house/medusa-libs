/** Stable `code` of the account errors – the storefront can translate them its own way. Keys match the `AccountsMessages` keys. */
export const ACCOUNT_ERROR_CODES = {
  /** An account with this e-mail already exists (409/422 from the workflows). */
  duplicateAccount: 'account_duplicate',
  /** The confirmation or set-password link expired or was already used (400). */
  linkExpired: 'account_link_expired',
  /** Too many account e-mails to one address in the throttle window (429). */
  tooManyRequests: 'account_too_many_requests',
  /** The current password given when changing the password does not match (400). */
  wrongCurrentPassword: 'account_wrong_current_password',
  /** The password given when deleting the account does not match (400). */
  wrongPassword: 'account_wrong_password',
  /** There is no signed-in customer (401). */
  signInAgain: 'account_sign_in_again',
  /** The session token has no issue time, other sessions cannot be ended (400). */
  tokenIssuedAtMissing: 'account_token_issued_at_missing',
  /** The order does not exist or is not the customer's (404). */
  orderNotFound: 'account_order_not_found',
  /** The cart does not exist or cannot be taken over (404). */
  cartNotFound: 'account_cart_not_found',
  /** The order has no invoice (404). */
  invoiceNotFound: 'account_invoice_not_found',
  /** The token was issued before the account's „sessions valid from” (401). */
  sessionExpired: 'account_session_expired',
  /** A route closed on purpose (404). */
  notFound: 'account_not_found',
  /** `metadata` of a customer cannot be written through the Store API (400). */
  metadataUnavailable: 'account_metadata_unavailable',
} as const

export type AccountErrorCode = (typeof ACCOUNT_ERROR_CODES)[keyof typeof ACCOUNT_ERROR_CODES]

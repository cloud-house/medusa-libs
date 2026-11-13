/** Stable `code` of the plugin's API errors – the storefront can translate them its own way. */
export const NEWSLETTER_ERROR_CODES = {
  /** 422 – the address is already on the list. */
  alreadySubscribed: 'newsletter_already_subscribed',
  /** 401 – no or wrong storefront secret (or none configured). */
  storefrontSecretInvalid: 'newsletter_storefront_secret_invalid',
} as const

export type NewsletterErrorCode =
  (typeof NEWSLETTER_ERROR_CODES)[keyof typeof NEWSLETTER_ERROR_CODES]

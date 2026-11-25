import { DEFAULT_STOREFRONT_URL } from '@cloud-house/medusa-accounts'

/** Storefront origin from `STOREFRONT_URL` (no trailing slash). */
export const storefrontUrl = (env: Record<string, string | undefined>): string =>
  (env.STOREFRONT_URL || DEFAULT_STOREFRONT_URL).replace(/\/+$/, '')

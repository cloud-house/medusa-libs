import 'server-only'
import Medusa from '@medusajs/js-sdk'
import type { MedusaEnv } from './env'

/**
 * Lazy singleton: a missing configuration must fail while fetching data, not when a page is
 * imported.
 */
export function createSdkGetter(env: () => MedusaEnv): () => Medusa {
  let sdk: Medusa | undefined
  return () => {
    if (!sdk) {
      const { backendUrl, publishableKey } = env()
      sdk = new Medusa({
        baseUrl: backendUrl,
        publishableKey,
        debug: process.env.NODE_ENV === 'development',
      })
    }
    return sdk
  }
}

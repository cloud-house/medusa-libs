import { StoreUnavailableError } from './errors'

export interface MedusaEnvOptions {
  /** Used when `MEDUSA_BACKEND_URL` is unset. */
  defaultBackendUrl?: string
  /** Text of the error thrown when `MEDUSA_PUBLISHABLE_KEY` is missing. */
  missingKeyMessage?: string
}

export interface MedusaEnv {
  backendUrl: string
  publishableKey: string
}

export function medusaEnv(options: MedusaEnvOptions = {}): MedusaEnv {
  const publishableKey = process.env.MEDUSA_PUBLISHABLE_KEY
  if (!publishableKey) {
    throw new StoreUnavailableError(
      options.missingKeyMessage ?? 'MEDUSA_PUBLISHABLE_KEY is not set in the storefront env.',
    )
  }
  return {
    backendUrl:
      process.env.MEDUSA_BACKEND_URL || options.defaultBackendUrl || 'http://localhost:9000',
    publishableKey,
  }
}

import type { NewsletterProvider } from './provider'
import { redactedError, type SubscribeDeps } from './subscribe'
import { isUniqueEmailError } from './unique-error'

/** The part of `@medusajs/js-sdk` `client` the sign-up uses. */
export type NewsletterFetch = <T>(
  path: string,
  init: {
    method?: 'POST'
    query?: Record<string, string>
    headers: Record<string, string>
    body?: unknown
    cache: 'no-store'
  },
) => Promise<T>

export interface NewsletterDepsOptions {
  /** `(path, init) => sdk.client.fetch(path, init)`. */
  fetch: NewsletterFetch
  /** Header with the storefront secret `medusa-newsletter` checks (only the shop's server may write). */
  secretHeader: string
  secret: string | undefined
  /** Mailing provider; `null` – sign-ups stay in Medusa only. */
  provider: NewsletterProvider | null
  /** Rate limit by IP. */
  allow: (ip: string) => boolean
  /** The whole consent text (the proof stored with every sign-up). */
  consentText: string
  /** Prefix of the log lines; default `[Newsletter]`. */
  logPrefix?: string
}

/** Sign-ups in Medusa's newsletter module (footer, home page, registration, checkout). */
export function createNewsletterDeps(options: NewsletterDepsOptions): SubscribeDeps {
  const logPrefix = options.logPrefix ?? '[Newsletter]'
  const headers = () => ({ [options.secretHeader]: options.secret ?? '' })
  return {
    exists: async (email) =>
      (
        await options.fetch<{ exists: boolean }>('/store/newsletter-subscribers', {
          query: { email },
          headers: headers(),
          cache: 'no-store',
        })
      ).exists,
    create: async (entry) => {
      await options.fetch('/store/newsletter-subscribers', {
        method: 'POST',
        headers: headers(),
        body: {
          email: entry.email,
          consent_text: entry.consentText,
          consent_at: entry.consentAt,
          source: entry.source,
        },
        cache: 'no-store',
      })
    },
    notify: async (email) => {
      if (!options.provider) return
      try {
        await options.provider.add(email)
      } catch (error) {
        console.error(
          `${logPrefix} Zapis na newsletter u dostawcy nie powiódł się: ${redactedError(error)}`,
        )
      }
    },
    isUniqueViolation: isUniqueEmailError,
    allow: options.allow,
    now: () => new Date(),
    log: (message) => console.error(message),
    consentText: options.consentText,
    logPrefix,
  }
}

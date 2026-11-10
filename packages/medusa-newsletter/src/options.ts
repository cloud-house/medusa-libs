import {
  NEWSLETTER_LOCALES,
  type NewsletterLocale,
  type NewsletterMessages,
  resolveMessages,
} from './messages'

/** The forms a sign-up can come from – the `source` enum of the model (and of its migration). */
export const NEWSLETTER_SOURCES = ['footer', 'home', 'register', 'checkout'] as const
export type NewsletterSource = (typeof NEWSLETTER_SOURCES)[number]

/** `plugins: [{ resolve: '@cloud-house/medusa-newsletter', options }]` in `medusa-config.ts`. */
export interface NewsletterOptions {
  /** Dictionary of the texts; default `'pl'`. */
  locale?: NewsletterLocale
  /** Single texts over the `locale` dictionary. */
  messages?: Partial<NewsletterMessages>
  /**
   * The shared secret that only the storefront's server sends with a sign-up: the request
   * header (default `x-storefront-secret`) and the env variable holding the value (default
   * `STOREFRONT_API_SECRET`). An empty env rejects every sign-up.
   */
  storefrontSecret?: { header?: string; env?: string }
  /** Sources the store route accepts; a subset of {@link NEWSLETTER_SOURCES} (default: all). */
  sources?: readonly string[]
}

export interface ResolvedNewsletterOptions {
  locale: NewsletterLocale
  messages: NewsletterMessages
  storefrontSecret: { header: string; env: string }
  sources: readonly NewsletterSource[]
}

export const DEFAULT_STOREFRONT_SECRET_HEADER = 'x-storefront-secret'
export const DEFAULT_STOREFRONT_SECRET_ENV = 'STOREFRONT_API_SECRET'

const isSource = (value: string): value is NewsletterSource =>
  (NEWSLETTER_SOURCES as readonly string[]).includes(value)

/** Options with the defaults filled in; throws on a locale or source the plugin does not know. */
export function resolveOptions(options: NewsletterOptions = {}): ResolvedNewsletterOptions {
  const locale = options.locale ?? 'pl'
  if (!NEWSLETTER_LOCALES.includes(locale))
    throw new Error(
      `@cloud-house/medusa-newsletter: unknown locale "${locale}" (use ${NEWSLETTER_LOCALES.join(', ')}).`,
    )
  const sources = options.sources ?? NEWSLETTER_SOURCES
  const unknown = sources.filter((source) => !isSource(source))
  if (unknown.length)
    throw new Error(
      `@cloud-house/medusa-newsletter: unknown sources ${unknown.join(', ')} (allowed: ${NEWSLETTER_SOURCES.join(', ')}).`,
    )
  return {
    locale,
    messages: resolveMessages(locale, options.messages),
    storefrontSecret: {
      // Node keeps incoming header names lower-case.
      header: (options.storefrontSecret?.header ?? DEFAULT_STOREFRONT_SECRET_HEADER).toLowerCase(),
      env: options.storefrontSecret?.env ?? DEFAULT_STOREFRONT_SECRET_ENV,
    },
    sources: sources.filter(isSource),
  }
}

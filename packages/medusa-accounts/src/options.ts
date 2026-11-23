import type { ContactResolver } from '@cloud-house/medusa-emails'
import type { MedusaContainer } from '@medusajs/framework/types'
import { ACCOUNT_EMAIL_LIMIT } from './lib/account-email-throttle'
import type { EmailThrottle } from './lib/types'
import {
  ACCOUNT_LOCALES,
  type AccountLocale,
  type AccountsMessages,
  resolveMessages,
  withoutUndefined,
} from './messages'

export type { EmailThrottle } from './lib/types'

/** Storefront paths the e-mail links point to (relative to `storefrontUrl`, e.g. `/account/confirm`). */
export interface AccountsPaths {
  confirmEmail: string
  passwordReset: string
  setPassword: string
}

/** `options` of the plugin in `medusa-config.ts`. */
export interface AccountsOptions {
  /** Dictionary of the API error texts; default `'pl'`. */
  locale?: AccountLocale
  /** Single texts over the `locale` dictionary. */
  messages?: Partial<AccountsMessages>
  /** Storefront origin for the e-mail links; default `process.env.STOREFRONT_URL`. */
  storefrontUrl?: string
  /** Where the e-mail links lead; required, no defaults. */
  paths: AccountsPaths
  /** Reads the shop's contact data shown in the e-mails. */
  resolveContact?: ContactResolver
  /** Run after an account was deleted (clean up the shop's own data of the customer). */
  onAccountDeleted?: ((container: MedusaContainer, customerId: string) => Promise<void>)[]
  /** At most `max` e-mails of one kind to one address per `windowMs`; default 3 per 15 minutes. */
  emailThrottle?: EmailThrottle
}

export interface ResolvedAccountsOptions {
  locale: AccountLocale
  messages: AccountsMessages
  storefrontUrl: string | null
  paths: AccountsPaths
  resolveContact: ContactResolver | null
  onAccountDeleted: ((container: MedusaContainer, customerId: string) => Promise<void>)[]
  emailThrottle: EmailThrottle
}

const fail = (message: string): never => {
  throw new Error(`@cloud-house/medusa-accounts: ${message}`)
}

const PATH_KEYS = ['confirmEmail', 'passwordReset', 'setPassword'] as const

/** Options with the defaults filled in (`undefined` values count as unset); throws on an invalid value. */
export function resolveOptions(options: AccountsOptions): ResolvedAccountsOptions {
  const {
    locale = 'pl',
    messages,
    storefrontUrl = process.env.STOREFRONT_URL,
    resolveContact = null,
    onAccountDeleted = [],
    emailThrottle = { ...ACCOUNT_EMAIL_LIMIT },
  } = withoutUndefined(options)

  if (!ACCOUNT_LOCALES.includes(locale))
    fail(`unknown locale "${locale}" (use ${ACCOUNT_LOCALES.join(', ')}).`)

  const paths = options?.paths
  if (!paths) fail('paths is required (confirmEmail, passwordReset, setPassword).')
  for (const key of PATH_KEYS) {
    if (!paths?.[key]) fail(`paths.${key} is required.`)
  }

  if (!(emailThrottle.max >= 1) || !(emailThrottle.windowMs > 0))
    fail('emailThrottle needs max >= 1 and windowMs > 0.')

  return {
    locale,
    messages: resolveMessages(locale, messages),
    storefrontUrl: storefrontUrl ? storefrontUrl.replace(/\/+$/, '') : null,
    paths: { ...(paths as AccountsPaths) },
    resolveContact,
    onAccountDeleted,
    emailThrottle,
  }
}

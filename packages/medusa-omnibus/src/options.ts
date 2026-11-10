import {
  OMNIBUS_LOCALES,
  type OmnibusLocale,
  type OmnibusMessages,
  resolveMessages,
  withoutUndefined,
} from './messages'

/** `plugins: [{ resolve: '@cloud-house/medusa-omnibus', options }]` in `medusa-config.ts`. */
export interface OmnibusOptions {
  /** Dictionary of the texts; default `'pl'`. */
  locale?: OmnibusLocale
  /** Single texts over the `locale` dictionary. */
  messages?: Partial<OmnibusMessages>
  /** Prepended to the job's log line as `prefix: text`; default none. */
  logPrefix?: string
}

export interface ResolvedOmnibusOptions {
  locale: OmnibusLocale
  messages: OmnibusMessages
  logPrefix: string
}

/** Options with the defaults filled in (`undefined` values count as unset); throws on an unknown locale. */
export function resolveOptions(options: OmnibusOptions = {}): ResolvedOmnibusOptions {
  const { locale = 'pl', logPrefix = '', messages } = withoutUndefined(options)
  if (!OMNIBUS_LOCALES.includes(locale))
    throw new Error(
      `@cloud-house/medusa-omnibus: unknown locale "${locale}" (use ${OMNIBUS_LOCALES.join(', ')}).`,
    )
  return { locale, messages: resolveMessages(locale, messages), logPrefix }
}

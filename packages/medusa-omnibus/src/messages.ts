/** The texts the plugin writes (the job's log line). */
export interface OmnibusMessages {
  /** Log line after the hourly job recorded `count` price changes. */
  recorded(count: number): string
}

export type OmnibusLocale = 'pl' | 'en'

export const OMNIBUS_LOCALES: readonly OmnibusLocale[] = ['pl', 'en']

export const messages: Record<OmnibusLocale, OmnibusMessages> = {
  pl: {
    recorded: (count) => `zapisano ${count} zmian cen w historii (Omnibus).`,
  },
  en: {
    recorded: (count) => `recorded ${count} price changes in the price history (Omnibus).`,
  },
}

/** Drops the keys whose value is `undefined`, so an unset override never wipes a default. */
export const withoutUndefined = <T extends object>(values: T | undefined): Partial<T> =>
  Object.fromEntries(
    Object.entries(values ?? {}).filter(([, value]) => value !== undefined),
  ) as Partial<T>

/** The dictionary of the locale with the single texts of `overrides` on top. */
export function resolveMessages(
  locale: OmnibusLocale,
  overrides?: Partial<OmnibusMessages>,
): OmnibusMessages {
  return { ...messages[locale], ...withoutUndefined(overrides) }
}

/** `prefix: text`, or just the text when there is no prefix. */
export const formatLog = (prefix: string | undefined, text: string): string =>
  prefix ? `${prefix}: ${text}` : text

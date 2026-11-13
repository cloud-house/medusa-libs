/** Log lines of `postRevalidate` and the subscriber. The `logPrefix` is put in front of each. */
export interface RevalidationMessages {
  /** Tags dropped because the storefront would reject them. */
  skippedTags(rejected: string[]): string
  /** The storefront answered with a non-2xx status. */
  rejected(status: number, tags: string[]): string
  /** The request failed (network, timeout). */
  failed(tags: string[], error: unknown): string
  /** Warned once when the URL or secret env variable is missing. */
  notConfigured(urlEnv: string, secretEnv: string): string
  /** The tags of an event could not be worked out. */
  tagsFailed(eventName: string, error: unknown): string
}

export type RevalidationLocale = 'pl' | 'en'

export const REVALIDATION_LOCALES: readonly RevalidationLocale[] = ['pl', 'en']

export const revalidationMessages: Record<RevalidationLocale, RevalidationMessages> = {
  en: {
    skippedTags: (rejected) =>
      `skipped tags outside the storefront allowlist: ${rejected.join(', ')}.`,
    rejected: (status, tags) =>
      `storefront revalidation rejected (${status}) for ${tags.join(', ')}.`,
    failed: (tags, error) => `storefront revalidation failed for ${tags.join(', ')}: ${error}`,
    notConfigured: (urlEnv, secretEnv) =>
      `${urlEnv} or ${secretEnv} is not set – the storefront refreshes Medusa data only when its cache expires.`,
    tagsFailed: (eventName, error) =>
      `could not work out revalidation tags for ${eventName}: ${error}`,
  },
  pl: {
    skippedTags: (rejected) => `pominięto tagi spoza białej listy sklepu: ${rejected.join(', ')}.`,
    rejected: (status, tags) => `rewalidacja sklepu odrzucona (${status}) dla ${tags.join(', ')}.`,
    failed: (tags, error) => `rewalidacja sklepu nie powiodła się dla ${tags.join(', ')}: ${error}`,
    notConfigured: (urlEnv, secretEnv) =>
      `brak ${urlEnv} lub ${secretEnv} – sklep odświeży dane Medusy dopiero po 5 minutach.`,
    tagsFailed: (eventName, error) =>
      `nie udało się ustalić tagów rewalidacji dla ${eventName}: ${error}`,
  },
}

/** `values` without the keys set to `undefined` (a spread would let them wipe a default). */
const withoutUndefined = <T extends object>(values: T | undefined): Partial<T> =>
  Object.fromEntries(
    Object.entries(values ?? {}).filter(([, value]) => value !== undefined),
  ) as Partial<T>

/** The `locale` dictionary with `overrides` on top (`undefined` ones ignored). */
export function resolveRevalidationMessages(
  locale: RevalidationLocale = 'en',
  overrides?: Partial<RevalidationMessages>,
): RevalidationMessages {
  return { ...revalidationMessages[locale], ...withoutUndefined(overrides) }
}

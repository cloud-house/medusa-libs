/**
 * Every text the plugin shows: API errors, the CSV header and the admin page. `{count}` and
 * `{email}` are filled in by the admin page. Plain data, so the admin page can get it over HTTP.
 */
export interface NewsletterMessages {
  /** 422 `already_subscribed`. */
  alreadySubscribed: string
  /** 401 `storefront_secret_invalid`. */
  unauthorized: string
  /** CSV header: e-mail, consent date, source, consent text. */
  csvColumns: [string, string, string, string]
  /** Admin menu and page heading. */
  adminTitle: string
  /** Under the heading; `{count}` – number of sign-ups. */
  adminDescription: string
  searchPlaceholder: string
  downloadCsv: string
  downloadFailed: string
  columnEmail: string
  columnSource: string
  columnConsentDate: string
  deleteButton: string
  /** `{email}` – the address being deleted. */
  deleteTitle: string
  deleteDescription: string
  deleteConfirm: string
  deleteCancel: string
  deleted: string
  previous: string
  next: string
  /** A failed request without a message of its own. */
  genericError: string
  /** BCP 47 locale of the consent dates on the admin page. */
  dateLocale: string
  /** Names of the sign-up forms (`source`) on the admin page. */
  sourceLabels: Record<string, string>
}

export type NewsletterLocale = 'pl' | 'en'

export const NEWSLETTER_LOCALES: readonly NewsletterLocale[] = ['pl', 'en']

export const messages: Record<NewsletterLocale, NewsletterMessages> = {
  pl: {
    alreadySubscribed: 'Ten adres jest już zapisany.',
    unauthorized: 'Brak dostępu.',
    csvColumns: ['email', 'data_zgody', 'zrodlo', 'tresc_zgody'],
    adminTitle: 'Newsletter',
    adminDescription:
      'Zapisy z formularzy sklepu ({count}). Nowe zapisy trafiają do Resend Audiences; wypis – link w mailu od Resend.',
    searchPlaceholder: 'Szukaj e-maila',
    downloadCsv: 'Pobierz CSV',
    downloadFailed: 'Nie udało się pobrać pliku.',
    columnEmail: 'E-mail',
    columnSource: 'Źródło',
    columnConsentDate: 'Data zgody',
    deleteButton: 'Usuń',
    deleteTitle: 'Usunąć {email}?',
    deleteDescription: 'Na życzenie klienta (RODO). Usuń kontakt także w panelu Resend.',
    deleteConfirm: 'Usuń',
    deleteCancel: 'Anuluj',
    deleted: 'Usunięto zapis',
    previous: 'Poprzednie',
    next: 'Następne',
    genericError: 'Coś poszło nie tak. Spróbuj ponownie.',
    dateLocale: 'pl-PL',
    sourceLabels: {
      footer: 'Stopka',
      home: 'Strona główna',
      register: 'Rejestracja konta',
      checkout: 'Kasa',
    },
  },
  en: {
    alreadySubscribed: 'This address is already subscribed.',
    unauthorized: 'Access denied.',
    csvColumns: ['email', 'consent_date', 'source', 'consent_text'],
    adminTitle: 'Newsletter',
    adminDescription:
      'Sign-ups from the shop forms ({count}). New sign-ups go to Resend Audiences; unsubscribing – the link in the Resend e-mail.',
    searchPlaceholder: 'Search e-mail',
    downloadCsv: 'Download CSV',
    downloadFailed: 'The file could not be downloaded.',
    columnEmail: 'E-mail',
    columnSource: 'Source',
    columnConsentDate: 'Consent date',
    deleteButton: 'Delete',
    deleteTitle: 'Delete {email}?',
    deleteDescription: 'At the customer’s request (GDPR). Delete the contact in Resend as well.',
    deleteConfirm: 'Delete',
    deleteCancel: 'Cancel',
    deleted: 'Sign-up deleted',
    previous: 'Previous',
    next: 'Next',
    genericError: 'Something went wrong. Please try again.',
    dateLocale: 'en-GB',
    sourceLabels: {
      footer: 'Footer',
      home: 'Home page',
      register: 'Account registration',
      checkout: 'Checkout',
    },
  },
}

/** `values` without the keys set to `undefined` (a spread would let them wipe a default). */
export const withoutUndefined = <T extends object>(values: T | undefined): Partial<T> =>
  Object.fromEntries(
    Object.entries(values ?? {}).filter(([, value]) => value !== undefined),
  ) as Partial<T>

/**
 * The `locale` dictionary with `overrides` on top (`undefined` ones ignored); `sourceLabels` are
 * merged label by label.
 */
export function resolveMessages(
  locale: NewsletterLocale,
  overrides: Partial<NewsletterMessages> = {},
): NewsletterMessages {
  const base = messages[locale]
  const { sourceLabels, ...texts } = withoutUndefined(overrides)
  return {
    ...base,
    ...texts,
    sourceLabels: {
      ...base.sourceLabels,
      ...(withoutUndefined(sourceLabels) as Record<string, string>),
    },
  }
}

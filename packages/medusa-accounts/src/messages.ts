/** Texts of the account API errors (the `message` of the response body). */
export interface AccountsMessages {
  /** Registration with an e-mail that already has an account. */
  duplicateAccount: string
  /** Confirmation / set-password link that expired or was already used. */
  linkExpired: string
  /** Too many account e-mails to one address. */
  tooManyRequests: string
  /** Change password: the current password is wrong. */
  wrongCurrentPassword: string
  /** Delete account: the password is wrong. */
  wrongPassword: string
  /** No signed-in customer. */
  signInAgain: string
  /** The session token has no `iat`. */
  tokenIssuedAtMissing: string
  /** Order not found (also an order of someone else). */
  orderNotFound: string
  /** Cart not found. */
  cartNotFound: string
  /** Invoice not found. */
  invoiceNotFound: string
}

export const ACCOUNT_LOCALES = ['pl', 'en'] as const
export type AccountLocale = (typeof ACCOUNT_LOCALES)[number]

export const messages: Record<AccountLocale, AccountsMessages> = {
  pl: {
    duplicateAccount: 'Konto z tym adresem już istnieje.',
    linkExpired: 'Link wygasł albo został już użyty.',
    tooManyRequests: 'Za dużo prób. Spróbuj ponownie za kilka minut.',
    wrongCurrentPassword: 'Obecne hasło jest nieprawidłowe.',
    wrongPassword: 'Nieprawidłowe hasło.',
    signInAgain: 'Zaloguj się ponownie.',
    tokenIssuedAtMissing: 'Brak czasu wydania tokenu.',
    orderNotFound: 'Nie znaleziono zamówienia.',
    cartNotFound: 'Nie znaleziono koszyka.',
    invoiceNotFound: 'Nie znaleziono faktury.',
  },
  en: {
    duplicateAccount: 'An account with this e-mail address already exists.',
    linkExpired: 'The link has expired or has already been used.',
    tooManyRequests: 'Too many attempts. Try again in a few minutes.',
    wrongCurrentPassword: 'The current password is incorrect.',
    wrongPassword: 'Incorrect password.',
    signInAgain: 'Please sign in again.',
    tokenIssuedAtMissing: 'The token has no issue time.',
    orderNotFound: 'Order not found.',
    cartNotFound: 'Cart not found.',
    invoiceNotFound: 'Invoice not found.',
  },
}

/** `values` without the keys set to `undefined` (a spread would let them wipe a default). */
export const withoutUndefined = <T extends object>(values: T | undefined): Partial<T> =>
  Object.fromEntries(
    Object.entries(values ?? {}).filter(([, value]) => value !== undefined),
  ) as Partial<T>

/** The `locale` dictionary with `overrides` on top (`undefined` ones ignored). */
export function resolveMessages(
  locale: AccountLocale,
  overrides: Partial<AccountsMessages> = {},
): AccountsMessages {
  return { ...messages[locale], ...withoutUndefined(overrides) }
}

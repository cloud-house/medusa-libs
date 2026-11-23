/**
 * Texts of the layout and the phrases every template shares. `{shopName}` and `{shopNameLocative}`
 * are filled in from the theme when the options are resolved; the other placeholders (`{email}`,
 * `{phone}`, `{hours}`, `{contact}`, `{seller}`) are filled in by the layout helpers.
 */
export interface EmailMessages {
  /** Bold lead of the contact card. */
  questionsTitle: string
  /** Contact card when replying is possible; `{contact}` is the e-mail and phone phrases. */
  replyOrWrite: string
  /** Contact card when replying is possible and no contact data is set. */
  replyOnly: string
  /** Contact card when replying is not possible; `{contact}`. */
  writeToUs: string
  /** `{email}`. */
  writeAt: string
  /** `{phone}`. */
  phone: string
  /** Phone with opening hours; `{phone}`, `{hours}`. */
  phoneWithHours: string
  /** Footer link to the terms. */
  termsLink: string
  /** Footer link to the privacy policy. */
  privacyLink: string
  /** Footer seller line; `{seller}`. */
  sellerLine: string
  /** "in the shop" phrase, e.g. for the reason line; `{shopNameLocative}`. */
  inShop: string
  /** Header text when there is no logo; `{shopName}`. */
  headerName: string
}

export type EmailLocale = 'pl' | 'en'

export const EMAIL_LOCALES: readonly EmailLocale[] = ['pl', 'en']

export const messages: Record<EmailLocale, EmailMessages> = {
  pl: {
    questionsTitle: 'Masz pytania?',
    replyOrWrite: 'Odpowiedz na tego maila albo {contact}.',
    replyOnly: 'Odpowiedz na tego maila.',
    writeToUs: 'Napisz do nas: {contact}.',
    writeAt: 'napisz na {email}',
    phone: 'tel. {phone}',
    phoneWithHours: 'tel. {phone} ({hours})',
    termsLink: 'Regulamin',
    privacyLink: 'Polityka prywatności',
    sellerLine: 'Sprzedawca: {seller}',
    inShop: 'w {shopNameLocative}',
    headerName: '{shopName}',
  },
  en: {
    questionsTitle: 'Questions?',
    replyOrWrite: 'Reply to this e-mail or {contact}.',
    replyOnly: 'Reply to this e-mail.',
    writeToUs: 'Write to us: {contact}.',
    writeAt: 'write to {email}',
    phone: 'call {phone}',
    phoneWithHours: 'call {phone} ({hours})',
    termsLink: 'Terms',
    privacyLink: 'Privacy policy',
    sellerLine: 'Seller: {seller}',
    inShop: 'at {shopNameLocative}',
    headerName: '{shopName}',
  },
}

/** `values` without the keys set to `undefined` (a spread would let them wipe a default). */
export const withoutUndefined = <T extends object>(values: T | undefined): Partial<T> =>
  Object.fromEntries(
    Object.entries(values ?? {}).filter(([, value]) => value !== undefined),
  ) as Partial<T>

/** The `locale` dictionary with `overrides` on top (`undefined` ones ignored). */
export function resolveMessages(
  locale: EmailLocale,
  overrides: Partial<EmailMessages> = {},
): EmailMessages {
  return { ...messages[locale], ...withoutUndefined(overrides) }
}

/** `text` with `{name}` placeholders replaced by `values` (unknown placeholders stay as they are). */
export const fillPlaceholders = (text: string, values: Record<string, string>): string =>
  text.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.hasOwn(values, key) ? values[key] : match,
  )

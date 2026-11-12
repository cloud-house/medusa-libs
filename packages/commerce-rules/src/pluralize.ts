/** Polish noun form after a number: [1, 2–4 (not 12–14), the rest] – produkt/produkty/produktów. */
export function pluralizePl(
  count: number,
  [one, few, many]: readonly [string, string, string],
): string {
  const n = Math.abs(Math.trunc(count))
  if (n === 1) return one
  const lastDigit = n % 10
  const lastTwoDigits = n % 100
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) return few
  return many
}

export interface PluralizeOptions {
  /** BCP 47 locale. Default `pl`. */
  locale?: string
}

/** Noun form after a number, picked by `Intl.PluralRules` (default locale `pl`). */
export function pluralize(
  count: number,
  forms: Partial<Record<Intl.LDMLPluralRule, string>> & { other: string },
  options: PluralizeOptions = {},
): string {
  return forms[new Intl.PluralRules(options.locale ?? 'pl').select(count)] ?? forms.other
}

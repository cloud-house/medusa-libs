import { isValidNip } from '../nip'
import { isValidPostalCode } from '../seller'

const EXTERNAL = /^https:\/\/[^/\s]+\.[^/\s]+/

/** Link w menu/stopce: ścieżka w sklepie („/kategoria”) albo pełny adres https. */
export function validateHref(
  value: string | null | undefined,
  { required = true }: { required?: boolean } = {},
): true | string {
  const href = value?.trim() ?? ''
  if (href === '') return required ? 'Podaj link.' : true
  if (/\s/.test(href)) return 'Link nie może zawierać spacji.'
  // „//host” i „/\host” przeglądarka traktuje jak adres innej domeny.
  if (href.startsWith('/') && !href.startsWith('//') && !href.startsWith('/\\')) return true
  if (EXTERNAL.test(href)) return true
  return 'Podaj ścieżkę zaczynającą się od „/” (np. /kategoria) albo pełny adres https://…'
}

/** Godzina w formacie GG:MM, np. „14:00”. */
export function validateTime(value: string | null | undefined): true | string {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value ?? '')
    ? true
    : 'Podaj godzinę w formacie GG:MM, np. 14:00.'
}

/** Kod pocztowy sprzedawcy – pusty albo 00-000. */
export function validatePostalCode(value: string | null | undefined): true | string {
  const code = value?.trim() ?? ''
  return code === '' || isValidPostalCode(code) ? true : 'Kod pocztowy w formacie 00-000.'
}

/** NIP sprzedawcy – pusty albo z poprawną sumą kontrolną. */
export function validateOptionalNip(value: string | null | undefined): true | string {
  const nip = value?.trim() ?? ''
  return nip === '' || isValidNip(nip) ? true : 'Nieprawidłowy NIP – sprawdź cyfry.'
}

/**
 * Address of a link inside page and article text: a shop path (`/…`, not `//host`), an anchor
 * (`#…`), `https://…`, `mailto:` or `tel:`. Anything else (`javascript:`, `data:`, `http:`) is refused
 * by the panel and dropped by the shop's renderer.
 */
export function isSafeLinkUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const url = value.trim()
  if (url === '') return false
  if (url.startsWith('#')) return true
  if (url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\')) return true
  if (url.startsWith('tel:')) return /^tel:\+?[0-9 ()-]+$/.test(url)
  if (/\s/.test(url)) return false
  return EXTERNAL.test(url) || /^mailto:[^\s@]+@[^\s@]+$/.test(url)
}

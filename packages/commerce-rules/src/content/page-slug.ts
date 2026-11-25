/** Adres strony informacyjnej (`/[slug]`): małe litery bez polskich znaków, cyfry, pojedyncze myślniki. */
export const PAGE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const MAX_SLUG_LENGTH = 80

/**
 * Segmenty zajęte przez trasy aplikacji, które nie zależą od sklepu. Sklep dokłada własne (kategorie,
 * konto, koszyk…) przez opcję `reservedSlugs` rodzaju `page`; test sklepu porównuje listę z katalogiem tras.
 */
export const DEFAULT_RESERVED_PAGE_SLUGS: readonly string[] = [
  'admin',
  'api',
  'dev',
  '_next',
  'icon',
  'apple-icon',
  'opengraph-image',
  'logo.png',
  'feeds',
]

export function isPageSlug(value: string): boolean {
  return value.length <= MAX_SLUG_LENGTH && PAGE_SLUG_PATTERN.test(value)
}

/** Komunikat walidacji pola „Adres” w panelu albo `null`. */
export function pageSlugError(
  value: unknown,
  reserved: readonly string[] = DEFAULT_RESERVED_PAGE_SLUGS,
): string | null {
  if (typeof value !== 'string' || value.trim() === '') return 'Podaj adres strony.'
  if (!isPageSlug(value)) {
    return 'Adres: małe litery bez polskich znaków, cyfry i myślniki (np. dostawa-i-zwroty).'
  }
  if (reserved.includes(value)) {
    return `Adres „${value}” zajmuje już sklep – wybierz inny.`
  }
  return null
}

/** Strony, które nie dają się usunąć ani cofnąć z publikacji (linkują do nich kasa i e-maile). */
export function isProtectedPageSlug(value: unknown, protectedSlugs: readonly string[]): boolean {
  return (protectedSlugs as readonly unknown[]).includes(value)
}

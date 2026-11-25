import { slugify } from '../slugify'
import { isPageSlug, MAX_SLUG_LENGTH, PAGE_SLUG_PATTERN } from './page-slug'

/** `/poradnik/kategoria/…` to strony kategorii – artykuł nie może mieć takiego adresu. */
export const RESERVED_ARTICLE_SLUGS = ['kategoria'] as const

/** Format jak adres strony informacyjnej (spec 4b §4.2) i adres spoza zarezerwowanych. */
export function isArticleSlug(value: string): boolean {
  return isPageSlug(value) && !(RESERVED_ARTICLE_SLUGS as readonly string[]).includes(value)
}

const formatError = (example: string) =>
  `Adres: małe litery bez polskich znaków, cyfry i myślniki (np. ${example}).`

/** Komunikat walidacji pola „Adres” artykułu albo `null`. */
export function articleSlugError(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return 'Podaj adres artykułu.'
  if (value.length > MAX_SLUG_LENGTH && PAGE_SLUG_PATTERN.test(value)) {
    return `Adres może mieć najwyżej ${MAX_SLUG_LENGTH} znaków – skróć go.`
  }
  if (!isPageSlug(value)) return formatError('jak-wybrac-deske')
  if (!isArticleSlug(value)) return `Adres „${value}” jest zajęty – wybierz inny.`
  return null
}

/** Komunikat walidacji pola „Adres” kategorii poradnika albo `null`. */
export function categorySlugError(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return 'Podaj adres kategorii.'
  return isPageSlug(value) ? null : formatError('sprzet')
}

/** Adres z tytułu artykułu – długie tytuły ucięte na granicy słowa do 80 znaków. */
export function articleSlugFromTitle(title: string): string {
  const slug = slugify(title)
  if (slug.length <= MAX_SLUG_LENGTH) return slug
  const cut = slug.slice(0, MAX_SLUG_LENGTH + 1)
  const end = cut.lastIndexOf('-')
  return (end > 0 ? cut.slice(0, end) : slug.slice(0, MAX_SLUG_LENGTH)).replace(/-+$/, '')
}

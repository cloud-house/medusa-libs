/** Kafli na stronie listy i kategorii – bez wyróżnionego artykułu (spec 4b §3). */
export const ARTICLES_PER_PAGE = 12

export const READING_WORDS_PER_MINUTE = 200

/** Numer strony z `?strona=`: brak → 1; tylko liczba bez zer wiodących, inaczej `null` (404). */
export function parsePageParam(value: string | string[] | undefined): number | null {
  if (value === undefined) return 1
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null
  const page = Number(value)
  return Number.isSafeInteger(page) ? page : null
}

/** „Czytaj także”: najpierw ta sama kategoria, potem najnowsze – bez bieżącego i powtórek. */
export function pickRelated<T extends { slug: string }>(
  current: string,
  sameCategory: T[],
  latest: T[],
  limit = 3,
): T[] {
  const picked: T[] = []
  const seen = new Set([current])
  for (const article of [...sameCategory, ...latest]) {
    if (picked.length >= limit) break
    if (seen.has(article.slug)) continue
    seen.add(article.slug)
    picked.push(article)
  }
  return picked
}

export const readingLabel = (minutes: number) => `${minutes} min`

const DATE = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Warsaw',
})

/** „21 października 2026”; brak albo zła data → `null`. */
export function publishedLabel(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : DATE.format(date)
}

// Kształty z data cache – po ich zmianie podbij wersję widoków treści.
/** Strona informacyjna gotowa do wyświetlenia. */
export interface PageDoc {
  slug: string
  title: string
  lead: string | null
  /** Stan edytora Lexical. */
  content: unknown
  effectiveFrom: string | null
  metaTitle: string | null
  metaDescription: string | null
}

export interface InfoNavItem {
  slug: string
  title: string
}

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null

export type RawPage = { slug: string; title: string } & Partial<
  Record<'lead' | 'content' | 'effectiveFrom' | 'metaTitle' | 'metaDescription', unknown>
>

export function mapPage(doc: RawPage): PageDoc {
  return {
    slug: doc.slug,
    title: doc.title,
    lead: text(doc.lead),
    content: doc.content ?? null,
    effectiveFrom: text(doc.effectiveFrom),
    metaTitle: text(doc.metaTitle),
    metaDescription: text(doc.metaDescription),
  }
}

const DATE = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Warsaw',
})

/** „Obowiązuje od 20 października 2026”. */
export function effectiveFromLabel(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : `Obowiązuje od ${DATE.format(date)}`
}

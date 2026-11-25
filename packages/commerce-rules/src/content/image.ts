// Shapes kept in the data cache (cmsCache): bump the content view version when they change.
type Doc = Record<string, unknown>

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null

/** Image from the media library, ready for the shop. */
export interface ImageRef {
  url: string
  alt: string
  width: number | null
  height: number | null
  credit: string | null
  creditUrl: string | null
}

export function toImage(value: unknown): ImageRef | null {
  const doc = value as (Doc & { url?: unknown }) | null
  if (!doc || typeof doc !== 'object' || typeof doc.url !== 'string') return null
  return {
    url: doc.url,
    alt: text(doc.alt) ?? '',
    width: typeof doc.width === 'number' ? doc.width : null,
    height: typeof doc.height === 'number' ? doc.height : null,
    credit: text(doc.credit),
    creditUrl: text(doc.creditUrl),
  }
}

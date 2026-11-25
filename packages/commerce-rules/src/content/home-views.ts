import { type ImageRef, toImage } from './image'

// Kształty z data cache – po ich zmianie podbij wersję widoków treści.
export type HomeLink = { label: string; href: string }
export type ProductTabSort = 'popular' | 'newest'

export type CoreHomeBlock =
  | {
      type: 'hero'
      id: string
      eyebrow: string | null
      title: string
      image: ImageRef | null
      cta: HomeLink
      /** Drugi przycisk; `null`, gdy w panelu pusty. */
      secondaryCta: HomeLink | null
      productHandle: string | null
    }
  | { type: 'trustBar'; id: string; items: { title: string; text: string | null }[] }
  | {
      type: 'categoryTiles'
      id: string
      heading: string
      intro: string | null
      tiles: { handle: string; subtitle: string | null; image: ImageRef | null }[]
    }
  | {
      type: 'brands'
      id: string
      eyebrow: string | null
      heading: string
      text: string | null
      link: HomeLink | null
    }
  | {
      type: 'productTabs'
      id: string
      tabs: { label: string; sort: ProductTabSort; categoryHandle: string | null }[]
      link: HomeLink | null
    }
  | {
      type: 'newsletter'
      id: string
      eyebrow: string | null
      heading: string
      text: string | null
      image: ImageRef | null
    }
  | { type: 'articles'; id: string; heading: string; link: HomeLink | null }

export type CoreHomeBlockOf<T extends CoreHomeBlock['type']> = Extract<CoreHomeBlock, { type: T }>

/** Blok dodatkowy sklepu (np. quiz, galeria): widok ma co najmniej `type` i `id`. */
export interface ExtraHomeBlock {
  type: string
  id: string
}

export interface HomePageView<B = CoreHomeBlock | ExtraHomeBlock> {
  blocks: B[]
  metaTitle: string | null
  metaDescription: string | null
}

// biome-ignore lint/suspicious/noExplicitAny: dokument z populacją – pola sprawdzamy po kolei
export type Doc = Record<string, any>

export const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null

export const rows = (value: unknown): Doc[] =>
  Array.isArray(value) ? value.filter((row) => row && typeof row === 'object') : []

/** Handle wypełnionej relacji; niewypełniona (samo id) albo usunięta (`null`) → `null`. */
export const relatedHandle = (value: unknown): string | null =>
  value && typeof value === 'object' ? text((value as Doc).handle) : null

export const toLink = (value: unknown): HomeLink | null => {
  const link = (value ?? {}) as Doc
  const label = text(link.label)
  const href = text(link.href)
  return label && href ? { label, href } : null
}

/** Widok bloku dodatkowego sklepu (`null` – blok pominięty). */
export type ExtraBlockMapper<B extends ExtraHomeBlock> = (raw: Doc, id: string) => B | null

function mapBlock<B extends ExtraHomeBlock>(
  raw: Doc,
  index: number,
  extras: Record<string, ExtraBlockMapper<B>>,
): CoreHomeBlock | B | null {
  const id = text(raw.id) ?? `blok-${index}`
  switch (raw.blockType) {
    case 'hero':
      return {
        type: 'hero',
        id,
        eyebrow: text(raw.eyebrow),
        title: text(raw.title) ?? '',
        image: toImage(raw.image),
        cta: { label: text(raw.cta?.label) ?? '', href: text(raw.cta?.href) ?? '/' },
        secondaryCta: toLink(raw.secondaryCta),
        productHandle: relatedHandle(raw.product),
      }
    case 'trustBar':
      return {
        type: 'trustBar',
        id,
        items: rows(raw.items).map((item) => ({
          title: text(item.title) ?? '',
          text: text(item.text),
        })),
      }
    case 'categoryTiles':
      return {
        type: 'categoryTiles',
        id,
        heading: text(raw.heading) ?? '',
        intro: text(raw.intro),
        tiles: rows(raw.tiles).flatMap((tile) => {
          const handle = relatedHandle(tile.category)
          return handle
            ? [{ handle, subtitle: text(tile.subtitle), image: toImage(tile.image) }]
            : []
        }),
      }
    case 'brands':
      return {
        type: 'brands',
        id,
        eyebrow: text(raw.eyebrow),
        heading: text(raw.heading) ?? '',
        text: text(raw.text),
        link: toLink(raw.link),
      }
    case 'productTabs':
      return {
        type: 'productTabs',
        id,
        tabs: rows(raw.tabs).map((tab) => ({
          label: text(tab.label) ?? '',
          sort: tab.sort === 'newest' ? 'newest' : 'popular',
          categoryHandle: relatedHandle(tab.category),
        })),
        link: toLink(raw.link),
      }
    case 'newsletter':
      return {
        type: 'newsletter',
        id,
        eyebrow: text(raw.eyebrow),
        heading: text(raw.heading) ?? '',
        text: text(raw.text),
        image: toImage(raw.image),
      }
    case 'articles':
      return { type: 'articles', id, heading: text(raw.heading) ?? '', link: toLink(raw.link) }
    default: {
      // Blok dodatkowy sklepu albo blok z nowszej wersji panelu (nieznany – pomijamy).
      const extra = typeof raw.blockType === 'string' ? extras[raw.blockType] : undefined
      return extra ? extra(raw, id) : null
    }
  }
}

/** Global „Strona główna” → widok sklepu; pusty układ albo brak dokumentu → `null`. */
export function mapHomePage<B extends ExtraHomeBlock = ExtraHomeBlock>(
  doc: unknown,
  extras: Record<string, ExtraBlockMapper<B>> = {},
): HomePageView<CoreHomeBlock | B> | null {
  if (!doc || typeof doc !== 'object') return null
  const raw = doc as Doc
  const blocks = rows(raw.layout)
    .map((row, index) => mapBlock(row, index, extras))
    .filter((block): block is CoreHomeBlock | B => block !== null)
  if (blocks.length === 0) return null
  return { blocks, metaTitle: text(raw.metaTitle), metaDescription: text(raw.metaDescription) }
}

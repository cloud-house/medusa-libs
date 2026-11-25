import type { ImageRef } from './image'
import { toImage } from './image'

// Kształty z data cache – po ich zmianie podbij wersję widoków treści.
export interface ArticleCategory {
  slug: string
  name: string
  description: string | null
}

/** Dane kafla artykułu – bez treści (spec 4b §6.1). */
export interface ArticleSummary {
  slug: string
  title: string
  lead: string
  category: { slug: string; name: string }
  readingMinutes: number
  publishedAt: string | null
  image: ImageRef | null
}

export interface ArticleDoc extends ArticleSummary {
  /** Stan edytora Lexical. */
  content: unknown
  metaTitle: string | null
  metaDescription: string | null
  /** Ostatnia zmiana w panelu – `dateModified` w JSON-LD (spec 6a §5.4). */
  updatedAt: string | null
}

export interface ArticleListPage {
  /** Najnowszy artykuł – tylko na pierwszej stronie `/poradnik`. */
  featured: ArticleSummary | null
  items: ArticleSummary[]
  page: number
  totalPages: number
}

// biome-ignore lint/suspicious/noExplicitAny: dokumenty z populacją – pola sprawdzamy po kolei
type Doc = Record<string, any>

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null

export function mapArticleSummary(doc: Doc): ArticleSummary {
  const category = doc.category && typeof doc.category === 'object' ? doc.category : null
  return {
    slug: doc.slug,
    title: doc.title,
    lead: text(doc.lead) ?? '',
    category: { slug: category?.slug ?? '', name: category?.name ?? '' },
    readingMinutes: typeof doc.readingMinutes === 'number' ? doc.readingMinutes : 1,
    publishedAt: text(doc.publishedAt),
    image: toImage(doc.image),
  }
}

export function mapArticle(doc: Doc): ArticleDoc {
  return {
    ...mapArticleSummary(doc),
    content: doc.content ?? null,
    metaTitle: text(doc.metaTitle),
    metaDescription: text(doc.metaDescription),
    updatedAt: text(doc.updatedAt),
  }
}

export const mapArticleCategory = (doc: Doc): ArticleCategory => ({
  slug: doc.slug,
  name: doc.name,
  description: text(doc.description),
})

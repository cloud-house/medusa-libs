import { isArticleSlug } from './article-slug'
import { isPageSlug } from './page-slug'

export type PreviewCollection = 'pages' | 'articles' | 'home-page'

/**
 * Adres do podglądu – tylko względna ścieżka sklepu zbudowana ze zwalidowanego adresu (bez
 * otwartego przekierowania): strona `/{slug}`, artykuł `/poradnik/{slug}`, strona główna `/`.
 */
export function previewTarget(
  slug: string | null | undefined,
  collection: string | null = 'pages',
): string | null {
  if (collection === 'home-page') return '/'
  if (!slug) return null
  if (collection === null || collection === 'pages') return isPageSlug(slug) ? `/${slug}` : null
  if (collection === 'articles') return isArticleSlug(slug) ? `/poradnik/${slug}` : null
  return null
}

import { ARTICLE_BLOCKS, articleSlugError, categorySlugError } from '@cloud-house/commerce-rules'
import { z } from '@medusajs/framework/zod'
import type { ContentKind } from '../kinds'
import { checked, lexical, mediaRef, optionalText, requiredText } from './common'
import { lexicalLinkError } from './lexical-rules'
import { LINK_MESSAGE, SHOP_LINKS, slugField } from './page'
import { articleView, categoryView } from './views'

const articleContent = checked(lexical, (value) =>
  lexicalLinkError(value, {
    collections: SHOP_LINKS,
    linkMessage: LINK_MESSAGE,
    uploads: true,
    blocks: Object.values(ARTICLE_BLOCKS),
    blockError: (_blockType, fields) => {
      const products = fields.products
      return Array.isArray(products) && products.length >= 1 && products.length <= 3
        ? null
        : 'Wybierz od 1 do 3 produktów.'
    },
  }),
)

/** Article; `readingMinutes` is computed from the content on every save. */
export const ArticleSchema = z.object({
  title: requiredText('Podaj tytuł artykułu.'),
  slug: slugField(articleSlugError),
  /** Entry id of the article category. */
  category: z
    .string()
    .nullish()
    .refine((value) => !!value, 'Wybierz kategorię.'),
  lead: requiredText('Podaj wstęp.'),
  image: mediaRef.refine((value) => !!value, 'Wybierz zdjęcie główne.'),
  content: articleContent,
  publishedAt: z
    .string()
    .datetime({ offset: true })
    .nullish()
    .transform((v) => v ?? null),
  metaTitle: optionalText,
  metaDescription: optionalText,
})

/** Softer check of a working copy: autosave keeps half-written articles (no category or image yet). */
export const ArticleDraftSchema = ArticleSchema.extend({
  category: z.string().nullish(),
  lead: optionalText,
  image: mediaRef,
})

export const ArticleCategorySchema = z.object({
  name: requiredText('Podaj nazwę kategorii.'),
  slug: slugField(categorySlugError),
  description: optionalText,
  order: z.number().int().default(100),
})

/** Blog articles: drafts, the newest 50 versions. */
export function articleKind(): ContentKind {
  return {
    type: 'article',
    label: 'Artykuły',
    schema: ArticleSchema,
    draftSchema: ArticleDraftSchema,
    versions: { drafts: true, maxVersions: 50 },
    refs: [
      ['image', 'media'],
      ['category', 'entry'],
      ['content', 'lexical'],
    ],
    view: articleView,
  }
}

export function articleCategoryKind(): ContentKind {
  return {
    type: 'article_category',
    label: 'Kategorie artykułów',
    schema: ArticleCategorySchema,
    view: categoryView,
  }
}

import {
  DEFAULT_RESERVED_PAGE_SLUGS,
  PAGE_BLOCKS,
  pageSlugError,
  SETTING_VALUE_OPTIONS,
} from '@cloud-house/commerce-rules'
import { z } from '@medusajs/framework/zod'
import type { ContentKind } from '../kinds'
import { checked, lexical, optionalText, requiredText } from './common'
import { lexicalLinkError } from './lexical-rules'
import { pageView } from './views'

/** Internal links in pages and articles – only shop content (an account would leak into the cache). */
export const SHOP_LINKS = [
  'pages',
  'articles',
  'product-content',
  'category-content',
  'brand-content',
]
export const LINK_MESSAGE =
  'Link wewnętrzny może prowadzić tylko do strony, artykułu, produktu, kategorii albo marki.'
const SETTING_KEYS = new Set<string>(SETTING_VALUE_OPTIONS.map((option) => option.value))

export const slugField = (error: (value: unknown) => string | null) =>
  z.string().superRefine((value, ctx) => {
    const message = error(value)
    if (message) ctx.addIssue({ code: 'custom', message })
  })

const pageContent = checked(lexical, (value) =>
  lexicalLinkError(value, {
    collections: SHOP_LINKS,
    linkMessage: LINK_MESSAGE,
    uploads: true,
    blocks: Object.values(PAGE_BLOCKS),
    blockError: (blockType, fields) =>
      blockType === PAGE_BLOCKS.settingValue && !SETTING_KEYS.has(String(fields.key ?? ''))
        ? 'Wybierz wartość z ustawień sklepu.'
        : null,
  }),
)

/** Info page (`/[slug]`); `legalReview` stays in the panel, the store never gets it. */
export const pageSchema = (reservedSlugs: readonly string[] = DEFAULT_RESERVED_PAGE_SLUGS) =>
  z.object({
    title: requiredText('Podaj tytuł strony.'),
    slug: slugField((value) => pageSlugError(value, reservedSlugs)),
    lead: optionalText,
    content: pageContent,
    effectiveFrom: z
      .string()
      .datetime({ offset: true })
      .nullish()
      .transform((v) => v ?? null),
    legalReview: z.boolean().default(false),
    inInfoNav: z.boolean().default(true),
    navOrder: z.number().int().default(100),
    metaTitle: optionalText,
    metaDescription: optionalText,
  })

export interface PageKindOptions {
  /** Addresses the shop's routes use, added to the built-in ones. */
  reservedSlugs?: string[]
  /** Pages that cannot be deleted, unpublished or renamed (checkout and e-mails link to them). */
  protectedSlugs?: string[]
}

/** Info pages with the full history of versions (legal proof of which text applied on a date). */
export function pageKind(options: PageKindOptions = {}): ContentKind {
  const schema = pageSchema([...DEFAULT_RESERVED_PAGE_SLUGS, ...(options.reservedSlugs ?? [])])
  return {
    type: 'page',
    label: 'Strony informacyjne',
    schema,
    draftSchema: schema,
    versions: { drafts: true, maxVersions: 0 },
    refs: [['content', 'lexical']],
    protectedSlugs: options.protectedSlugs ?? [],
    view: pageView,
  }
}

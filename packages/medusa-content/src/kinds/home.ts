import {
  CORE_HOME_BLOCK_LABELS,
  CORE_SINGLE_HOME_BLOCKS,
  type ExtraBlockMapper,
  type ExtraHomeBlock,
  type HomeLayoutRules,
  homeLayoutError,
  homeTokenError,
  mapHomePage,
  validateHref,
} from '@cloud-house/commerce-rules'
import type { MedusaContainer } from '@medusajs/framework/types'
import { z } from '@medusajs/framework/zod'
import type { ContentKind } from '../kinds'
import type { EntryData, RefKind } from '../types'
import { checked, mediaRef } from './common'
import { populated } from './views'

const filled = (value: unknown) => typeof value === 'string' && value.trim() !== ''
const trimmed = (value: string | null | undefined) => (value?.trim() ? value.trim() : null)

/** Short text of a block: settings tokens like `{dni-zwrotu}` and a length limit. */
export const homeText = (max: number, required = false) =>
  z
    .string()
    .nullish()
    .superRefine((value, ctx) => {
      if (required && !filled(value))
        return void ctx.addIssue({ code: 'custom', message: 'Uzupełnij pole.' })
      const tokens = homeTokenError(value)
      if (tokens !== true) return void ctx.addIssue({ code: 'custom', message: tokens })
      if ((value ?? '').length > max)
        ctx.addIssue({ code: 'custom', message: `Najwyżej ${max} znaków.` })
    })
    .transform(trimmed)

const href = checked(z.string(), (value) => validateHref(value))
const optionalHref = checked(z.string().nullish().transform(trimmed), (value) =>
  validateHref(value, { required: false }),
)
const optionalLink = z
  .object({ label: homeText(40), href: optionalHref })
  .nullish()
  .transform((value) => value ?? { label: null, href: null })

/** Second hero button: both values or none. */
const secondaryCta = z
  .object({ label: homeText(40), href: z.string().nullish().transform(trimmed) })
  .nullish()
  .superRefine((value, ctx) => {
    if (!value) return
    if (filled(value.label) !== filled(value.href)) {
      ctx.addIssue({
        code: 'custom',
        message: filled(value.label)
          ? 'Podaj też adres przycisku.'
          : 'Podaj też etykietę przycisku.',
      })
    } else if (filled(value.href)) {
      const error = validateHref(value.href)
      if (error !== true) ctx.addIssue({ code: 'custom', message: error })
    }
  })
  .transform((value) => value ?? { label: null, href: null })

/** A required image (used by the shop's own blocks as well). */
export const requiredMedia = mediaRef.refine((value) => !!value, 'Wybierz zdjęcie.')
/** `id` and `blockName` every block row has; spread into a block's zod object. */
export const homeBlockBase = { id: z.string().min(1), blockName: z.string().nullish() }
export { optionalLink as homeOptionalLink }

const base = homeBlockBase

const CORE_BLOCKS = [
  z.object({
    ...base,
    blockType: z.literal('hero'),
    eyebrow: homeText(80),
    title: homeText(80, true),
    image: requiredMedia,
    cta: z.object({ label: homeText(40, true), href }),
    secondaryCta,
    /** Medusa product id; card with name and price on the photo. */
    product: z
      .string()
      .nullish()
      .transform((value) => value ?? null),
  }),
  z.object({
    ...base,
    blockType: z.literal('trustBar'),
    items: z
      .array(z.object({ title: homeText(40, true), text: homeText(60) }))
      .min(2, 'Co najmniej 2 pozycje.')
      .max(4, 'Najwyżej 4 pozycje.'),
  }),
  z.object({
    ...base,
    blockType: z.literal('categoryTiles'),
    heading: homeText(80, true),
    intro: homeText(240),
    tiles: z
      .array(
        z.object({
          /** Medusa category id. */
          category: z.string().min(1, 'Wybierz kategorię.'),
          subtitle: homeText(40),
          image: mediaRef,
        }),
      )
      .min(2, 'Co najmniej 2 kafle.')
      .max(6, 'Najwyżej 6 kafli.'),
  }),
  z.object({
    ...base,
    blockType: z.literal('brands'),
    eyebrow: homeText(40),
    heading: homeText(80, true),
    text: homeText(320),
    link: optionalLink,
  }),
  z.object({
    ...base,
    blockType: z.literal('productTabs'),
    tabs: z
      .array(
        z.object({
          label: homeText(30, true),
          sort: z.enum(['popular', 'newest']).default('popular'),
          category: z
            .string()
            .nullish()
            .transform((value) => value ?? null),
        }),
      )
      .min(1, 'Co najmniej jedna zakładka.')
      .max(3, 'Najwyżej 3 zakładki.'),
    link: optionalLink,
  }),
  z.object({
    ...base,
    blockType: z.literal('newsletter'),
    eyebrow: homeText(40),
    heading: homeText(80, true),
    text: homeText(320),
    image: mediaRef,
  }),
  z.object({
    ...base,
    blockType: z.literal('articles'),
    heading: homeText(80, true),
    link: optionalLink,
  }),
]

/** A home-page block of the shop beyond the built-in ones. */
export interface HomeBlockDefinition {
  /** The `blockType` of the rows. */
  type: string
  /** The name in the panel and in the „only once” message. */
  label: string
  /** Zod object of one row with `blockType: z.literal(type)` and `homeBlockBase`. */
  // biome-ignore lint/suspicious/noExplicitAny: any zod object with a literal `blockType`
  schema: z.ZodObject<any>
  /** The block may appear once in the layout. */
  single?: boolean
  /** References inside the block, as absolute paths (e.g. `layout.*.photos.*.image`). */
  refs?: [path: string, kind: RefKind | 'lexical'][]
  /** Store view of one row (`null` – skipped). */
  view?: ExtraBlockMapper<ExtraHomeBlock>
  /** Adds data that needs I/O to the mapped block (e.g. a feed). */
  enrich?: (block: ExtraHomeBlock, ctx: { container: MedusaContainer }) => Promise<ExtraHomeBlock>
}

const meta = {
  metaTitle: z.string().nullish().transform(trimmed),
  metaDescription: z.string().nullish().transform(trimmed),
}

export interface HomePageKindOptions {
  extraBlocks?: HomeBlockDefinition[]
  /** The home page the store shows until one is saved (`HomePageView` of commerce-rules). */
  defaults?: unknown
  /** The data the panel starts a new home page from (layout, meta title and description). */
  initial?: EntryData
}

/** Home page of blocks: hero first, single hero / trust bar / newsletter (+ the shop's single blocks). */
export function homePageKind(options: HomePageKindOptions = {}): ContentKind {
  const extras = options.extraBlocks ?? []
  const rules: HomeLayoutRules = {
    labels: {
      ...CORE_HOME_BLOCK_LABELS,
      ...Object.fromEntries(extras.map((block) => [block.type, block.label])),
    },
    single: [...CORE_SINGLE_HOME_BLOCKS, ...extras.filter((b) => b.single).map((b) => b.type)],
  }
  const blocks = z.discriminatedUnion('blockType', [
    ...CORE_BLOCKS,
    ...extras.map((block) => block.schema),
  ] as unknown as [(typeof CORE_BLOCKS)[number], ...(typeof CORE_BLOCKS)[number][]])
  const mappers = Object.fromEntries(
    extras.flatMap((block) => (block.view ? [[block.type, block.view]] : [])),
  )
  const enrichers = new Map(
    extras.flatMap((block) => (block.enrich ? [[block.type, block.enrich] as const] : [])),
  )
  return {
    type: 'global',
    slug: 'home-page',
    label: 'Strona główna',
    /** Published: the layout rules apply. */
    schema: z.object({ layout: z.array(blocks).default([]), ...meta }).superRefine((value, ctx) => {
      const error = homeLayoutError(value.layout, rules)
      if (error !== true) ctx.addIssue({ code: 'custom', message: error, path: ['layout'] })
    }),
    /** Working copy: blocks may be half-filled while the editor types. */
    draftSchema: z.object({
      layout: z
        .array(z.object({ blockType: z.string(), id: z.string() }).passthrough())
        .default([]),
      ...meta,
    }),
    versions: { drafts: true, maxVersions: 50 },
    refs: [
      ['layout.*.image', 'media'],
      ['layout.*.tiles.*.image', 'media'],
      ['layout.*.product', 'product'],
      ['layout.*.tiles.*.category', 'category'],
      ['layout.*.tabs.*.category', 'category'],
      ...extras.flatMap((block) => block.refs ?? []),
    ],
    defaults: options.defaults,
    initial: options.initial,
    view: (item, ctx) => mapHomePage(populated(item, ctx), mappers),
    enrich: async (view, ctx) => {
      const page = view as { blocks: ExtraHomeBlock[] } | null
      if (!page || !enrichers.size) return view
      const blocks = await Promise.all(
        page.blocks.map((block) => enrichers.get(block.type)?.(block, ctx) ?? block),
      )
      return { ...page, blocks }
    },
  }
}

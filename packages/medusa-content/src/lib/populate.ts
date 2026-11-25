import type { MedusaContainer } from '@medusajs/framework/types'
import type { KindRegistry } from '../kinds'
import { CONTENT_MODULE } from '../modules/content'
import type ContentModuleService from '../modules/content/service'
import type { EntryRow, RefKind } from '../types'
import { findEntities } from './entities'
import { contentOptions } from './plugin-options'
import { collectRefs, mapRefs } from './refs'

export interface MediaDoc {
  id: string
  url: string
  alt: string
  width: number | null
  height: number | null
  credit: string | null
  creditUrl: string | null
  filesize: number
  filename: string
  mimeType: string
}

/** A related Medusa document as the shop's mappers read it (`medusaStatus` – it still exists). */
export interface CatalogDoc {
  id: string
  handle: string
  title: string
  medusaStatus: 'active'
}

export interface EntryDoc {
  id: string
  type: string
  slug: string | null
  name: string | null
  title: string | null
}

export interface Lookups {
  media: Map<string, MediaDoc>
  product: Map<string, CatalogDoc>
  category: Map<string, CatalogDoc>
  brand: Map<string, CatalogDoc>
  entry: Map<string, EntryDoc>
}

export const emptyLookups = (): Lookups => ({
  media: new Map(),
  product: new Map(),
  category: new Map(),
  brand: new Map(),
  entry: new Map(),
})

const idsOf = (refs: { target_type: string; target_id: string }[], kind: RefKind) => [
  ...new Set(refs.filter((ref) => ref.target_type === kind).map((ref) => ref.target_id)),
]

/**
 * Loads every document the given entries point at – one query per kind. Only published entries
 * are reachable from the store (an unpublished article drops out of a link like a deleted one).
 */
export async function loadLookups(
  container: MedusaContainer,
  sources: { type: string; slug: string | null; data: unknown }[],
  { drafts = false }: { drafts?: boolean } = {},
): Promise<Lookups> {
  const registry = contentOptions(container).registry
  const refs = sources.flatMap((source) =>
    collectRefs(registry, source.type, source.slug, source.data),
  )
  const lookups = emptyLookups()
  const content: ContentModuleService = container.resolve(CONTENT_MODULE)

  const mediaIds = idsOf(refs, 'media')
  const idsFor = {
    product: idsOf(refs, 'product'),
    category: idsOf(refs, 'category'),
    brand: idsOf(refs, 'brand'),
  }
  const entryIds = idsOf(refs, 'entry')

  await Promise.all([
    mediaIds.length &&
      content.listMediaAssets({ id: mediaIds }, { take: null }).then((rows) => {
        for (const row of rows) {
          lookups.media.set(row.id, {
            id: row.id,
            url: row.url,
            alt: row.alt,
            width: row.width ?? null,
            height: row.height ?? null,
            credit: row.credit ?? null,
            creditUrl: row.credit_url ?? null,
            filesize: Number(row.filesize),
            filename: row.filename,
            mimeType: row.mime_type,
          })
        }
      }),
    ...(['product', 'category', 'brand'] as const).map(
      (kind) =>
        idsFor[kind].length &&
        findEntities(container, kind, 'id', idsFor[kind]).then((docs) => {
          for (const doc of docs) lookups[kind].set(doc.id, { ...doc, medusaStatus: 'active' })
        }),
    ),
    entryIds.length &&
      content.listContentEntries({ id: entryIds }, { take: null }).then((rows) => {
        for (const row of rows as unknown as EntryRow[]) {
          const source = drafts
            ? (row.draft ?? row.data)
            : row.status === 'published'
              ? row.data
              : null
          if (!source) continue
          lookups.entry.set(row.id, {
            id: row.id,
            type: row.type,
            slug: typeof source.slug === 'string' ? source.slug : row.slug,
            name: typeof source.name === 'string' ? source.name : null,
            title: typeof source.title === 'string' ? source.title : null,
          })
        }
      }),
  ])
  return lookups
}

/** `data` with ids replaced by documents; a missing one becomes `null` (dropped by the mappers). */
export function populate(
  registry: KindRegistry,
  type: string,
  slug: string | null,
  data: unknown,
  lookups: Lookups,
): Record<string, unknown> {
  return (mapRefs(registry, type, slug, data, (kind, id) => lookups[kind].get(id) ?? null) ??
    {}) as Record<string, unknown>
}

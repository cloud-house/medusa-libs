import type { MedusaContainer } from '@medusajs/framework/types'
import { CONTENT_MODULE } from '../modules/content'
import type ContentModuleService from '../modules/content/service'
import { type EntityKind, type EntryData, type EntryRow, GLOBAL_TYPE } from '../types'
import { type EntityDoc, findEntities } from './entities'
import { type Lookups, loadLookups } from './populate'

export type { Lookups }

/** State the store reads: published data, or – in preview – the working copy. */
export const stateOf = (row: EntryRow, draft: boolean): EntryData | null =>
  draft ? (row.draft ?? row.data) : row.status === 'published' ? row.data : null

const service = (container: MedusaContainer): ContentModuleService =>
  container.resolve(CONTENT_MODULE)

export async function listEntries(container: MedusaContainer, type: string): Promise<EntryRow[]> {
  return (await service(container).listContentEntries(
    { type },
    { order: { created_at: 'DESC' }, take: null },
  )) as unknown as EntryRow[]
}

/** Published entries of a type (or working copies in preview), with their state. */
export async function readable(container: MedusaContainer, type: string, draft = false) {
  return (await listEntries(container, type)).flatMap((row) => {
    const data = stateOf(row, draft)
    return data ? [{ row, data }] : []
  })
}

/** An entry by address – published one, or in preview also by the address of its working copy. */
export async function bySlug(
  container: MedusaContainer,
  type: string,
  slug: string,
  draft: boolean,
): Promise<{ row: EntryRow; data: EntryData } | null> {
  if (!draft) {
    // The address column is the published address of a published entry – one indexed row.
    const [row] = (await service(container).listContentEntries(
      { type, slug, status: 'published' },
      { take: 1 },
    )) as unknown as EntryRow[]
    const data = row ? stateOf(row, false) : null
    return row && data ? { row, data } : null
  }
  const rows = await readable(container, type, true)
  return rows.find(({ data }) => data.slug === slug) ?? null
}

/**
 * The published entry of a kind – a global by its key (`readPublished(c, 'global', 'header')`), any
 * other by its address; in preview the working copy. `null` when there is none.
 */
export async function readPublished(
  container: MedusaContainer,
  type: string,
  slug: string,
  { draft = false }: { draft?: boolean } = {},
): Promise<{ row: EntryRow; data: EntryData } | null> {
  if (type !== GLOBAL_TYPE) return bySlug(container, type, slug, draft)
  const [row] = (await service(container).listContentEntries(
    { type, slug },
    { take: 1 },
  )) as unknown as EntryRow[]
  const data = row ? stateOf(row, draft) : null
  return row && data ? { row, data } : null
}

/**
 * Content bound to a Medusa product, category or brand, by the record's handle. `entry` is `null`
 * (and `data` empty) when nothing is saved yet; an unknown handle gives `null`.
 */
export async function readEntity(
  container: MedusaContainer,
  kind: EntityKind,
  handle: string,
  { draft = false }: { draft?: boolean } = {},
): Promise<{ entity: EntityDoc; row: EntryRow | null; data: EntryData } | null> {
  const [entity] = await findEntities(container, kind, 'handle', [handle])
  if (!entity) return null
  const [row] = (await service(container).listContentEntries(
    { type: kind, entity_id: entity.id },
    { take: 1 },
  )) as unknown as EntryRow[]
  return { entity, row: row ?? null, data: (row && stateOf(row, draft)) ?? {} }
}

/** When the store's version last changed: the latest publication (draft saves do not count). */
export const modifiedAt = (row: EntryRow) =>
  new Date(row.last_published_at ?? row.published_at ?? row.updated_at).toISOString()

export async function lookupsFor(
  container: MedusaContainer,
  items: { row: EntryRow; data: EntryData }[],
  draft = false,
): Promise<Lookups> {
  return loadLookups(
    container,
    items.map(({ row, data }) => ({ type: row.type, slug: row.slug, data })),
    { drafts: draft },
  )
}

/** Newest first: publication date, then creation – like the old panel's list. */
export function byNewest(
  a: { row: EntryRow; data: EntryData },
  b: { row: EntryRow; data: EntryData },
) {
  const date = (item: { row: EntryRow; data: EntryData }) =>
    typeof item.data.publishedAt === 'string' ? Date.parse(item.data.publishedAt) : 0
  return (
    date(b) - date(a) || new Date(b.row.created_at).getTime() - new Date(a.row.created_at).getTime()
  )
}

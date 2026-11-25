import type { MedusaContainer } from '@medusajs/framework/types'
import type { EntryRow } from '../types'
import { loadLookups } from './populate'

/** An entry for the panel's editor with the documents it points at (pickers show names, images). */
export async function adminEntry(container: MedusaContainer, entry: EntryRow) {
  const lookups = await loadLookups(
    container,
    [entry.data, entry.draft].map((data) => ({ type: entry.type, slug: entry.slug, data })),
    { drafts: true },
  )
  return {
    entry,
    related: Object.fromEntries(
      Object.entries(lookups).map(([kind, map]) => [kind, Object.fromEntries(map)]),
    ),
  }
}

/** Title shown in panel lists. */
export function entryTitle(entry: EntryRow): string {
  const source = entry.draft ?? entry.data ?? {}
  const title = source.title ?? source.name
  return typeof title === 'string' && title ? title : (entry.slug ?? entry.id)
}

export const actorId = (req: { auth_context?: { actor_id?: string } }) =>
  req.auth_context?.actor_id ?? null

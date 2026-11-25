/** What a stored id points at. `lexical` – editor state with its own links, images and blocks. */
export type RefKind = 'media' | 'product' | 'category' | 'brand' | 'entry'

/** Medusa records a kind can be bound to (`entity_id` of the entry). */
export type EntityKind = 'product' | 'category' | 'brand'

export const ENTITY_KINDS: readonly EntityKind[] = ['product', 'category', 'brand']

/** `type` of the rows that hold the globals (header, footer…); their `slug` is the key. */
export const GLOBAL_TYPE = 'global'

export type EntryData = Record<string, unknown>

export interface EntryRow {
  id: string
  type: string
  slug: string | null
  entity_id: string | null
  status: 'draft' | 'published'
  data: EntryData | null
  draft: EntryData | null
  published_at: Date | null
  /** Latest publication – the „modified” date the store shows (draft saves do not change it). */
  last_published_at: Date | null
  updated_by: string | null
  created_at: Date
  updated_at: Date
}

export interface VersionRow {
  id: string
  entry_id: string
  snapshot: EntryData
  status: 'draft' | 'published'
  autosave: boolean
  created_by: string | null
  created_at: Date
}

export interface RefInput {
  target_type: RefKind
  target_id: string
}

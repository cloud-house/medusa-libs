import type { MedusaContainer } from '@medusajs/framework/types'
import type { z } from '@medusajs/framework/zod'
import { CONTENT_ERROR_CODES, contentError } from './errors'
import { ENTITY_KINDS, type EntityKind, type EntryRow, GLOBAL_TYPE, type RefKind } from './types'

export interface VersionPolicy {
  /** Working copy (`draft`) with autosave, preview and a separate „Publish”. */
  drafts: boolean
  /** History rows kept: `0` – unlimited, `null` – no history. */
  maxVersions: number | null
}

export const NO_VERSIONS: VersionPolicy = { drafts: false, maxVersions: null }

/** Where the store view of an entry is built: the entry, whether it is a preview, the container. */
export interface ViewContext {
  container: MedusaContainer
  draft: boolean
}

/**
 * One kind of content: the shape, the version policy and the references of a `type` of entries.
 * A global kind (`type: 'global'`) is one document with a `slug` as its key (header, footer…).
 */
export interface ContentKind {
  /** `[a-z0-9_]{1,40}`; `global` for a single document identified by `slug`. */
  type: string
  /** Key of a global (`[a-z0-9-]{1,60}`); required for `type: 'global'`, forbidden otherwise. */
  slug?: string
  /** The name in the panel. */
  label: string
  /** Checked on publishing. */
  schema: z.ZodType
  /** Softer check of a working copy; default `schema`. */
  draftSchema?: z.ZodType
  /** Default: no drafts, no history. */
  versions?: VersionPolicy
  /** Paths of references in the data (`*` – every row of an array). */
  refs?: [path: string, kind: RefKind | 'lexical'][]
  /** The Medusa record the entries are bound to (`entity_id`). */
  entity?: EntityKind
  /** Store view of the entry; default the data with media filled in. */
  view?: (row: EntryRow, ctx: ViewContext) => unknown
}

const TYPE_KEY = /^[a-z0-9_]{1,40}$/
const SLUG_KEY = /^[a-z0-9-]{1,60}$/

/** Validates one kind and returns a copy with the defaults filled in. */
export function defineKind(kind: ContentKind): ContentKind {
  const invalid = (reason: string) =>
    contentError(
      CONTENT_ERROR_CODES.invalidOption,
      `kinds: ${reason} (kind "${String(kind?.type)}${kind?.slug ? `/${kind.slug}` : ''}").`,
    )
  if (typeof kind?.type !== 'string' || !TYPE_KEY.test(kind.type)) {
    throw invalid(`type must match [a-z0-9_]{1,40}`)
  }
  if (typeof kind.label !== 'string' || !kind.label.trim()) throw invalid('label is required')
  if (!kind.schema || typeof kind.schema.safeParse !== 'function') {
    throw invalid('schema must be a zod schema')
  }
  if (kind.draftSchema !== undefined && typeof kind.draftSchema.safeParse !== 'function') {
    throw invalid('draftSchema must be a zod schema')
  }
  if (kind.type === GLOBAL_TYPE) {
    if (typeof kind.slug !== 'string' || !SLUG_KEY.test(kind.slug)) {
      throw invalid(`a global kind needs a slug matching [a-z0-9-]{1,60}`)
    }
  } else if (kind.slug !== undefined) {
    throw invalid(`slug is only for type "${GLOBAL_TYPE}"`)
  }
  if (kind.entity !== undefined && !ENTITY_KINDS.includes(kind.entity)) {
    throw invalid(`entity must be one of ${ENTITY_KINDS.join(', ')}`)
  }
  if (kind.entity !== undefined && kind.type === GLOBAL_TYPE) {
    throw invalid('a global kind cannot be bound to an entity')
  }
  const versions = kind.versions ?? NO_VERSIONS
  if (typeof versions.drafts !== 'boolean') throw invalid('versions.drafts must be a boolean')
  if (
    versions.maxVersions !== null &&
    (!Number.isInteger(versions.maxVersions) || versions.maxVersions < 0)
  ) {
    throw invalid('versions.maxVersions must be null, 0 (unlimited) or a positive integer')
  }
  return { ...kind, versions: { ...versions }, refs: [...(kind.refs ?? [])] }
}

/** The kinds a shop registered, looked up by `type` (and `slug` for globals). */
export class KindRegistry {
  private readonly byKey = new Map<string, ContentKind>()
  private readonly list: ContentKind[]

  constructor(kinds: ContentKind[]) {
    if (!Array.isArray(kinds) || kinds.length === 0) {
      throw contentError(
        CONTENT_ERROR_CODES.invalidOption,
        'option "kinds" needs at least one kind (see contentKinds()).',
      )
    }
    this.list = kinds.map(defineKind)
    for (const kind of this.list) {
      const key = keyOf(kind.type, kind.slug ?? null)
      if (this.byKey.has(key)) {
        throw contentError(
          CONTENT_ERROR_CODES.invalidOption,
          kind.type === GLOBAL_TYPE
            ? `kinds: two global kinds have the slug "${kind.slug}".`
            : `kinds: type "${kind.type}" is registered twice.`,
        )
      }
      this.byKey.set(key, kind)
    }
  }

  kinds(): ContentKind[] {
    return [...this.list]
  }

  get(type: string, slug: string | null = null): ContentKind | undefined {
    return this.byKey.get(keyOf(type, slug))
  }

  /** `true` when `key` is the slug of a registered global. */
  isGlobalKey(key: string): boolean {
    return this.byKey.has(keyOf(GLOBAL_TYPE, key))
  }

  globalKeys(): string[] {
    return this.list.filter((kind) => kind.type === GLOBAL_TYPE).map((kind) => kind.slug as string)
  }

  /** Kinds bound to a Medusa product, category or brand. */
  entityKinds(): (ContentKind & { entity: EntityKind })[] {
    return this.list.filter(
      (kind): kind is ContentKind & { entity: EntityKind } => kind.entity !== undefined,
    )
  }

  /** Schema of an entry for publishing, or the softer one for a working copy. */
  schemaFor(type: string, slug: string | null, mode: 'publish' | 'draft'): z.ZodType {
    const kind = this.require(type, slug)
    return mode === 'draft' ? (kind.draftSchema ?? kind.schema) : kind.schema
  }

  policyFor(type: string, slug: string | null): VersionPolicy {
    return this.get(type, slug)?.versions ?? NO_VERSIONS
  }

  refPathsFor(type: string, slug: string | null): [string, RefKind | 'lexical'][] {
    return this.get(type, slug)?.refs ?? []
  }

  private require(type: string, slug: string | null): ContentKind {
    const kind = this.get(type, slug)
    if (!kind) throw new Error(`Nieznany typ treści: ${type}/${slug}`)
    return kind
  }
}

const keyOf = (type: string, slug: string | null) =>
  type === GLOBAL_TYPE ? `global:${slug}` : type

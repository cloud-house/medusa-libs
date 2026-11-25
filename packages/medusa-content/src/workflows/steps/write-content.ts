import { isProtectedPageSlug } from '@cloud-house/commerce-rules'
import type { MedusaContainer } from '@medusajs/framework/types'
import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk'
import { invalidContent, notAllowed, PROTECTED_MESSAGE, slugTaken } from '../../lib/api-errors'
import { defaultEntityHandle } from '../../lib/entities'
import { contentOptions } from '../../lib/plugin-options'
import { CONTENT_MODULE } from '../../modules/content'
import { versionPolicy } from '../../modules/content/policy'
import type ContentModuleService from '../../modules/content/service'
import { type EntryData, type EntryRow, GLOBAL_TYPE } from '../../types'

/** Which entry: an existing one, a new page / article / category, or the content of a Medusa entity / global. */
export type ContentTarget =
  | { id: string }
  | { type: string }
  | { type: string; entity_id: string }
  | { type: 'global'; key: string }

export interface WriteContentInput {
  target: ContentTarget
  /** `autosave` / `draft` – the working copy; `publish` – what the store shows. */
  mode: 'autosave' | 'draft' | 'publish'
  data: unknown
  expected_updated_at?: string | null
  user_id?: string | null
  /** Seeds only – never set from HTTP: lets a script rename or rewrite protected pages. */
  allow_protected_change?: boolean
}

export interface WriteContentOutput {
  entry: EntryRow
  previous_slug: string | null
  handle: string | null
  published: boolean
}

type Snapshot = Pick<EntryRow, 'id' | 'data' | 'draft' | 'status' | 'slug' | 'published_at'> & {
  created: boolean
}

async function findOrCreate(
  container: MedusaContainer,
  content: ContentModuleService,
  target: ContentTarget,
): Promise<{ row: EntryRow; created: boolean }> {
  if ('id' in target) {
    return {
      row: (await content.retrieveContentEntry(target.id)) as unknown as EntryRow,
      created: false,
    }
  }
  const registry = contentOptions(container).registry
  const filters =
    target.type === 'global' && 'key' in target
      ? { type: GLOBAL_TYPE, slug: target.key }
      : 'entity_id' in target
        ? { type: target.type, entity_id: target.entity_id }
        : null
  if (filters) {
    const [found] = (await content.listContentEntries(filters, {
      take: 1,
    })) as unknown as EntryRow[]
    if (found) return { row: found, created: false }
  }
  if ('key' in target && !registry.isGlobalKey(target.key)) {
    throw notAllowed(`Nieznany element układu: ${target.key}.`)
  }
  if (!('key' in target) && !registry.get(target.type)) {
    throw notAllowed(`Nieznany typ treści: ${target.type}.`)
  }
  const row = (await content.createContentEntries({
    type: target.type,
    slug: 'key' in target ? target.key : null,
    entity_id: 'entity_id' in target ? target.entity_id : null,
    status: 'draft',
  })) as unknown as EntryRow
  return { row, created: true }
}

/** Handle of the Medusa document an entity entry belongs to (for cache tags). */
export async function entityHandle(
  container: MedusaContainer,
  row: EntryRow,
): Promise<string | null> {
  if (!row.entity_id) return null
  const kind = contentOptions(container).registry.get(row.type)?.entity
  if (!kind) return null
  const resolve = contentOptions(container).resolveEntityHandle ?? defaultEntityHandle
  return resolve(container, kind, row.entity_id)
}

async function assertSlugFree(content: ContentModuleService, row: EntryRow, slug: string) {
  const taken = (await content.listContentEntries(
    { type: row.type },
    { select: ['id', 'slug', 'draft'], take: null },
  )) as unknown as EntryRow[]
  const clash = taken.some(
    (other) => other.id !== row.id && (other.slug === slug || other.draft?.slug === slug),
  )
  if (clash) throw slugTaken()
}

export async function writeContent(
  container: MedusaContainer,
  input: WriteContentInput,
): Promise<{ output: WriteContentOutput; snapshot: Snapshot }> {
  const content: ContentModuleService = container.resolve(CONTENT_MODULE)
  const { row, created } = await findOrCreate(container, content, input.target)
  const snapshot: Snapshot = {
    id: row.id,
    data: row.data,
    draft: row.draft,
    status: row.status,
    slug: row.slug,
    published_at: row.published_at,
    created,
  }
  try {
    const { registry } = contentOptions(container)
    const kind = registry.get(row.type, row.slug)
    const policy = versionPolicy(registry, row.type, row.slug)
    const publishing = input.mode === 'publish' || !policy.drafts
    const parsed = registry
      .schemaFor(row.type, row.slug, publishing ? 'publish' : 'draft')
      .safeParse(input.data)
    if (!parsed.success) throw invalidContent(parsed.error)
    let data = parsed.data as EntryData

    let slug = row.slug
    // Kinds whose data carries an address (pages, articles…); globals and entity content have none.
    if (row.type !== GLOBAL_TYPE && !kind?.entity && typeof data.slug === 'string') {
      const next = String(data.slug)
      if (
        row.slug &&
        next !== row.slug &&
        isProtectedPageSlug(row.slug, kind?.protectedSlugs ?? []) &&
        !input.allow_protected_change
      ) {
        throw notAllowed(PROTECTED_MESSAGE.slug)
      }
      if (next !== row.slug) await assertSlugFree(content, row, next)
      // The column holds the address the store uses: the published one, or – for an entry the
      // store does not show – the working copy's (so an old draft address does not stay taken).
      if (publishing || row.status !== 'published') slug = next
    }
    if (kind?.prepare) data = kind.prepare(data, { row, publishing })

    const common = {
      id: row.id,
      data,
      // Written by the service after the freshness check, in the same update.
      ...(slug !== row.slug ? { slug } : {}),
      // A just-created entry has nothing to conflict with.
      expectedUpdatedAt: created ? null : input.expected_updated_at,
      userId: input.user_id,
    }
    const entry = publishing
      ? await content.publish(common)
      : await content.saveDraft({ ...common, autosave: input.mode === 'autosave' })

    return {
      output: {
        entry,
        previous_slug: publishing && row.slug !== entry.slug ? row.slug : null,
        handle: await entityHandle(container, entry),
        published: publishing,
      },
      snapshot,
    }
  } catch (error) {
    await restoreSnapshot(content, snapshot)
    throw error
  }
}

export async function restoreSnapshot(content: ContentModuleService, snapshot: Snapshot) {
  if (snapshot.created) {
    await content.deleteContentEntries(snapshot.id)
    return
  }
  const { created: _created, ...fields } = snapshot
  await content.updateContentEntries(fields)
}

export const writeContentStep = createStep(
  'write-content',
  async (input: WriteContentInput, { container }) => {
    const { output, snapshot } = await writeContent(container, input)
    return new StepResponse(output, snapshot)
  },
  async (snapshot, { container }) => {
    if (snapshot) await restoreSnapshot(container.resolve(CONTENT_MODULE), snapshot)
  },
)

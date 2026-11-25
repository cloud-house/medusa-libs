import { isProtectedPageSlug } from '@cloud-house/commerce-rules'
import type { MedusaContainer } from '@medusajs/framework/types'
import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk'
import { notAllowed, PROTECTED_MESSAGE } from '../../lib/api-errors'
import { contentOptions } from '../../lib/plugin-options'
import { CONTENT_MODULE } from '../../modules/content'
import { versionPolicy } from '../../modules/content/policy'
import type ContentModuleService from '../../modules/content/service'
import { type EntryRow, GLOBAL_TYPE } from '../../types'
import { entityHandle, restoreSnapshot } from './write-content'

const snapshotOf = (row: EntryRow) => ({
  id: row.id,
  data: row.data,
  draft: row.draft,
  status: row.status,
  slug: row.slug,
  published_at: row.published_at,
  created: false,
})

const service = (container: MedusaContainer): ContentModuleService =>
  container.resolve(CONTENT_MODULE)

export interface UnpublishInput {
  id: string
  expected_updated_at?: string | null
  user_id?: string | null
}

export async function unpublishContent(container: MedusaContainer, input: UnpublishInput) {
  const content = service(container)
  const row = (await content.retrieveContentEntry(input.id)) as unknown as EntryRow
  const { registry } = contentOptions(container)
  if (!versionPolicy(registry, row.type, row.slug).drafts) {
    throw notAllowed('Tej treści nie można wycofać z publikacji.')
  }
  if (isProtectedPageSlug(row.slug, registry.get(row.type, row.slug)?.protectedSlugs ?? [])) {
    throw notAllowed(PROTECTED_MESSAGE.unpublish)
  }
  const entry = await content.unpublish({
    id: row.id,
    expectedUpdatedAt: input.expected_updated_at,
    userId: input.user_id,
  })
  return {
    output: { entry, handle: await entityHandle(container, entry) },
    snapshot: snapshotOf(row),
  }
}

export const unpublishContentStep = createStep(
  'unpublish-content',
  async (input: UnpublishInput, { container }) => {
    const { output, snapshot } = await unpublishContent(container, input)
    return new StepResponse(output, snapshot)
  },
  async (snapshot, { container }) => {
    if (snapshot) await restoreSnapshot(service(container), snapshot)
  },
)

export const restoreContentVersionStep = createStep(
  'restore-content-version',
  async (input: { version_id: string; user_id?: string | null }, { container }) => {
    const content = service(container)
    const version = await content.retrieveContentVersion(input.version_id)
    const row = (await content.retrieveContentEntry(version.entry_id)) as unknown as EntryRow
    const entry = await content.restoreVersion({
      versionId: input.version_id,
      userId: input.user_id,
    })
    return new StepResponse(
      {
        entry,
        handle: await entityHandle(container, entry),
        published:
          entry.status === 'published' &&
          !versionPolicy(contentOptions(container).registry, row.type, row.slug).drafts,
      },
      snapshotOf(row),
    )
  },
  async (snapshot, { container }) => {
    if (snapshot) await restoreSnapshot(service(container), snapshot)
  },
)

/** Deletes an entry with its history; protected pages, globals and guarded entries stay. */
export async function deleteContent(
  container: MedusaContainer,
  input: { id: string; allow_protected_change?: boolean },
) {
  const content = service(container)
  const row = (await content.retrieveContentEntry(input.id)) as unknown as EntryRow
  const kind = contentOptions(container).registry.get(row.type, row.slug)
  if (isProtectedPageSlug(row.slug, kind?.protectedSlugs ?? []) && !input.allow_protected_change) {
    throw notAllowed(PROTECTED_MESSAGE.delete)
  }
  if (kind?.deleteGuard) {
    const users = await content.entriesUsing({ target_type: 'entry', target_id: row.id }, row.id)
    if (users.some((user) => kind.deleteGuard?.usedBy.includes(user.type))) {
      throw notAllowed(kind.deleteGuard.message)
    }
  }
  if (row.type === GLOBAL_TYPE) throw notAllowed('Elementów układu nie można usunąć.')
  const handle = await entityHandle(container, row)
  const versions = await content.listContentVersions(
    { entry_id: row.id },
    { select: ['id'], take: null },
  )
  const refs = await content.listContentRefs({ entry_id: row.id }, { select: ['id'], take: null })
  if (versions.length) await content.deleteContentVersions(versions.map((version) => version.id))
  if (refs.length) await content.deleteContentRefs(refs.map((ref) => ref.id))
  await content.deleteContentEntries(row.id)
  return { entry: row, handle }
}

export const deleteContentStep = createStep(
  'delete-content',
  async (input: { id: string; allow_protected_change?: boolean }, { container }) =>
    new StepResponse(await deleteContent(container, input)),
)

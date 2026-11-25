import type { MedusaContainer } from '@medusajs/framework/types'
import { CONTENT_MODULE } from '../modules/content'
import type ContentModuleService from '../modules/content/service'
import type { EntityKind } from '../types'

export type CatalogKind = EntityKind

/**
 * Keeps the mirror of current handles: a changed handle leaves a redirect from the old one;
 * a deleted document takes its content, mirror row and redirects with it. Returns the old handle
 * when the document was renamed. Safe to run twice for the same event.
 */
export async function recordHandle(
  container: MedusaContainer,
  kind: CatalogKind,
  entityId: string,
  handle: string | null,
): Promise<{ renamed_from: string | null; deleted: boolean }> {
  const content: ContentModuleService = container.resolve(CONTENT_MODULE)
  const [mirror] = await content.listCatalogHandles({ kind, entity_id: entityId }, { take: 1 })

  if (handle === null) {
    if (mirror) await content.deleteCatalogHandles(mirror.id)
    const redirects = await content.listHandleRedirects(
      { kind, entity_id: entityId },
      { select: ['id'], take: null },
    )
    if (redirects.length) await content.deleteHandleRedirects(redirects.map((row) => row.id))
    const entries = await content.listContentEntries(
      { type: kind, entity_id: entityId },
      { select: ['id'], take: null },
    )
    for (const entry of entries) {
      const versions = await content.listContentVersions(
        { entry_id: entry.id },
        { select: ['id'], take: null },
      )
      const refs = await content.listContentRefs(
        { entry_id: entry.id },
        { select: ['id'], take: null },
      )
      if (versions.length) await content.deleteContentVersions(versions.map((row) => row.id))
      if (refs.length) await content.deleteContentRefs(refs.map((row) => row.id))
      await content.deleteContentEntries(entry.id)
    }
    return { renamed_from: null, deleted: true }
  }

  if (!mirror) {
    await content.createCatalogHandles({ kind, entity_id: entityId, handle })
    return { renamed_from: null, deleted: false }
  }
  if (mirror.handle === handle) return { renamed_from: null, deleted: false }
  await content.createHandleRedirects({ kind, entity_id: entityId, old_handle: mirror.handle })
  await content.updateCatalogHandles({ id: mirror.id, handle })
  return { renamed_from: mirror.handle, deleted: false }
}

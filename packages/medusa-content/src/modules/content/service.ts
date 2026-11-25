import type { Context } from '@medusajs/framework/types'
import {
  InjectTransactionManager,
  MedusaContext,
  MedusaError,
  MedusaService,
} from '@medusajs/framework/utils'
import { type ContentOptions, type ResolvedContentOptions, resolveOptions } from '../../options'
import type { EntryData, EntryRow, RefInput, VersionRow } from '../../types'
import { ContentEntry } from './models/content-entry'
import { ContentRef } from './models/content-ref'
import { ContentVersion } from './models/content-version'
import { CatalogHandle, HandleRedirect } from './models/handle-redirect'
import { MediaAsset } from './models/media-asset'
import { CONFLICT_MESSAGE, versionPolicy } from './policy'

export type { EntryData, EntryRow, RefInput, VersionRow }

interface WriteInput {
  id: string
  /** New address column (pages, articles, article categories), applied after the freshness check. */
  slug?: string | null
  /** `updated_at` the editor started from; a newer row means someone else saved meanwhile. */
  expectedUpdatedAt?: string | Date | null
  userId?: string | null
}

const sameInstant = (a: string | Date, b: string | Date) =>
  new Date(a).getTime() === new Date(b).getTime()

class ContentModuleService extends MedusaService({
  ContentEntry,
  ContentVersion,
  ContentRef,
  MediaAsset,
  CatalogHandle,
  HandleRedirect,
}) {
  protected readonly options_: ResolvedContentOptions

  // biome-ignore lint/suspicious/noExplicitAny: the container type of MedusaService
  constructor(_container: Record<string, any>, options?: ContentOptions) {
    // biome-ignore lint/complexity/noArguments: MedusaService takes every constructor argument
    super(...arguments)
    this.options_ = resolveOptions(options as ContentOptions)
  }

  /** The plugin options with the defaults filled in. */
  getOptions(): ResolvedContentOptions {
    return this.options_
  }

  private policy(row: Pick<EntryRow, 'type' | 'slug'>) {
    return versionPolicy(this.options_.registry, row.type, row.slug)
  }

  private async entry(id: string, sharedContext: Context): Promise<EntryRow> {
    return (await this.retrieveContentEntry(id, {}, sharedContext)) as unknown as EntryRow
  }

  /**
   * The entry for a write: the row is locked until the transaction ends, so a second write from the
   * same starting state waits and then fails the freshness check instead of overwriting silently.
   */
  private async lockedEntry(id: string, sharedContext: Context): Promise<EntryRow> {
    const manager = sharedContext.transactionManager as
      | { execute(sql: string, params: unknown[]): Promise<unknown> }
      | undefined
    await manager?.execute('select id from "content_entry" where id = ? for update', [id])
    return this.entry(id, sharedContext)
  }

  private checkFresh(row: EntryRow, expected: WriteInput['expectedUpdatedAt']) {
    if (expected && !sameInstant(row.updated_at, expected)) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, CONFLICT_MESSAGE)
    }
  }

  private async addVersion(
    row: EntryRow,
    version: { snapshot: EntryData; status: 'draft' | 'published'; autosave: boolean },
    userId: string | null | undefined,
    sharedContext: Context,
  ) {
    const { maxVersions } = this.policy(row)
    if (maxVersions === null) return
    const [latest] = (await this.listContentVersions(
      { entry_id: row.id },
      { order: { created_at: 'DESC' }, take: 1 },
      sharedContext,
    )) as unknown as VersionRow[]
    // One rolling autosave per editor between publications – typing does not flood the history.
    if (
      version.autosave &&
      latest?.autosave &&
      latest.status === 'draft' &&
      latest.created_by === (userId ?? null)
    ) {
      await this.updateContentVersions({ id: latest.id, snapshot: version.snapshot }, sharedContext)
      return
    }
    await this.createContentVersions(
      { entry_id: row.id, ...version, created_by: userId ?? null },
      sharedContext,
    )
    if (maxVersions > 0) await this.pruneVersions(row.id, maxVersions, sharedContext)
  }

  private async pruneVersions(entryId: string, max: number, sharedContext: Context) {
    const versions = (await this.listContentVersions(
      { entry_id: entryId },
      { select: ['id'], order: { created_at: 'DESC' }, take: null },
      sharedContext,
    )) as unknown as VersionRow[]
    const old = versions.slice(max).map((version) => version.id)
    if (old.length) await this.deleteContentVersions(old, sharedContext)
  }

  /** Working copy of a type with drafts; `autosave` folds into the editor's rolling version. */
  @InjectTransactionManager()
  async saveDraft(
    input: WriteInput & { data: EntryData; autosave?: boolean },
    @MedusaContext() sharedContext: Context = {},
  ): Promise<EntryRow> {
    const row = await this.lockedEntry(input.id, sharedContext)
    if (!this.policy(row).drafts) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, 'Ta treść nie ma wersji roboczych.')
    }
    this.checkFresh(row, input.expectedUpdatedAt)
    await this.updateContentEntries(
      {
        id: row.id,
        draft: input.data,
        updated_by: input.userId ?? null,
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
      },
      sharedContext,
    )
    await this.addVersion(
      row,
      { snapshot: input.data, status: 'draft', autosave: input.autosave ?? false },
      input.userId,
      sharedContext,
    )
    return this.entry(row.id, sharedContext)
  }

  /**
   * Publishes `data` (or the working copy) – the store reads only published entries. Types
   * without drafts are saved this way too.
   */
  @InjectTransactionManager()
  async publish(
    input: WriteInput & { data?: EntryData },
    @MedusaContext() sharedContext: Context = {},
  ): Promise<EntryRow> {
    const row = await this.lockedEntry(input.id, sharedContext)
    this.checkFresh(row, input.expectedUpdatedAt)
    const data = input.data ?? row.draft ?? row.data
    if (!data) throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Brak treści do publikacji.')
    await this.updateContentEntries(
      {
        id: row.id,
        data,
        draft: null,
        status: 'published',
        published_at: row.published_at ?? new Date(),
        last_published_at: new Date(),
        updated_by: input.userId ?? null,
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
      },
      sharedContext,
    )
    await this.addVersion(
      row,
      { snapshot: data, status: 'published', autosave: false },
      input.userId,
      sharedContext,
    )
    return this.entry(row.id, sharedContext)
  }

  /** Back to a draft: the store stops showing it, the editor keeps working on the same content. */
  @InjectTransactionManager()
  async unpublish(input: WriteInput, @MedusaContext() sharedContext: Context = {}) {
    const row = await this.lockedEntry(input.id, sharedContext)
    this.checkFresh(row, input.expectedUpdatedAt)
    await this.updateContentEntries(
      {
        id: row.id,
        status: 'draft',
        draft: row.draft ?? row.data,
        updated_by: input.userId ?? null,
      },
      sharedContext,
    )
    return this.entry(row.id, sharedContext)
  }

  /**
   * A version goes back into the working copy – publishing stays the editor's step, so the usual
   * checks run. Types without drafts (store settings) are published at once.
   */
  @InjectTransactionManager()
  async restoreVersion(
    input: { versionId: string; userId?: string | null },
    @MedusaContext() sharedContext: Context = {},
  ): Promise<EntryRow> {
    const version = (await this.retrieveContentVersion(
      input.versionId,
      {},
      sharedContext,
    )) as unknown as VersionRow
    const row = await this.entry(version.entry_id, sharedContext)
    if (this.policy(row).drafts) {
      return this.saveDraft(
        { id: row.id, data: version.snapshot, userId: input.userId },
        sharedContext,
      )
    }
    return this.publish({ id: row.id, data: version.snapshot, userId: input.userId }, sharedContext)
  }

  /** Version published at `at` – the newest publication not later than that moment. */
  async publishedVersionAt(entryId: string, at: Date): Promise<VersionRow | null> {
    const [version] = (await this.listContentVersions(
      { entry_id: entryId, status: 'published', created_at: { $lte: at } },
      { order: { created_at: 'DESC' }, take: 1 },
    )) as unknown as VersionRow[]
    return version ?? null
  }

  async listVersions(entryId: string): Promise<VersionRow[]> {
    return (await this.listContentVersions(
      { entry_id: entryId },
      { order: { created_at: 'DESC' }, take: null },
    )) as unknown as VersionRow[]
  }

  /** Replaces what one state of an entry points at. */
  @InjectTransactionManager()
  async replaceRefs(
    entryId: string,
    state: 'published' | 'draft',
    refs: RefInput[],
    @MedusaContext() sharedContext: Context = {},
  ) {
    const old = await this.listContentRefs(
      { entry_id: entryId, state },
      { select: ['id'], take: null },
      sharedContext,
    )
    if (old.length)
      await this.deleteContentRefs(
        old.map((ref) => ref.id),
        sharedContext,
      )
    const unique = new Map(refs.map((ref) => [`${ref.target_type}:${ref.target_id}`, ref]))
    if (unique.size) {
      await this.createContentRefs(
        [...unique.values()].map((ref) => ({ entry_id: entryId, state, ...ref })),
        sharedContext,
      )
    }
  }

  /** Entries (other than `exceptEntryId`) whose published or working state uses the target. */
  async entriesUsing(
    target: RefInput,
    exceptEntryId?: string,
  ): Promise<{ id: string; type: string; slug: string | null; title: string | null }[]> {
    const refs = await this.listContentRefs(
      { target_type: target.target_type, target_id: target.target_id },
      { select: ['entry_id'], take: null },
    )
    const ids = [...new Set(refs.map((ref) => ref.entry_id))].filter((id) => id !== exceptEntryId)
    if (ids.length === 0) return []
    const rows = (await this.listContentEntries(
      { id: ids },
      { take: null },
    )) as unknown as EntryRow[]
    return rows.map((row) => {
      const source = row.draft ?? row.data
      const title = source && typeof source.title === 'string' ? source.title : null
      return { id: row.id, type: row.type, slug: row.slug, title }
    })
  }
}

export default ContentModuleService

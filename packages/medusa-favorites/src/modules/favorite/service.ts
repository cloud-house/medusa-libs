import type { Context } from '@medusajs/framework/types'
import { InjectTransactionManager, MedusaContext, MedusaService } from '@medusajs/framework/utils'
import { type FavoriteEntry, mergeFavorites } from '../../lib/favorites'
import { type FavoritesOptions, type ResolvedFavoritesOptions, resolveOptions } from '../../options'
import { Favorite } from './models/favorite'

class FavoriteModuleService extends MedusaService({ Favorite }) {
  protected readonly options_: ResolvedFavoritesOptions

  /**
   * Medusa hands a module its `options` as the second argument; a plugin's modules get the
   * plugin's `options` from `medusa-config.ts`. Routes read them through {@link getOptions}.
   */
  // biome-ignore lint/suspicious/noExplicitAny: the container type of MedusaService
  constructor(_container: Record<string, any>, options?: FavoritesOptions) {
    // biome-ignore lint/complexity/noArguments: MedusaService takes every constructor argument
    super(...arguments)
    this.options_ = resolveOptions(options)
  }

  /** The plugin options with the defaults filled in and the texts merged. */
  getOptions(): ResolvedFavoritesOptions {
    return this.options_
  }

  /** The customer's favourites, newest first. */
  async listForCustomer(customerId: string): Promise<FavoriteEntry[]> {
    const rows = await this.listFavorites(
      { customer_id: customerId },
      { order: { added_at: 'DESC' }, take: null },
    )
    return rows.map((row) => ({ product_id: row.product_id, added_at: new Date(row.added_at) }))
  }

  /**
   * ♥ on a product. The limit counts only products the shop shows (`hiddenProductIds` – drafts,
   * outside the sales channel); hidden rows stay until they would block the limit.
   */
  async addForCustomer(
    customerId: string,
    productId: string,
    now: Date,
    hiddenProductIds: string[] = [],
  ): Promise<'added' | 'exists' | 'limit'> {
    const rows = await this.listFavorites(
      { customer_id: customerId },
      { select: ['id', 'product_id'], take: null },
    )
    if (rows.some((row) => row.product_id === productId)) return 'exists'
    const hidden = new Set(hiddenProductIds)
    const hiddenRows = rows.filter((row) => hidden.has(row.product_id))
    if (rows.length - hiddenRows.length >= this.options_.limit) return 'limit'
    if (rows.length >= this.options_.limit)
      await this.deleteFavorites(hiddenRows.map((row) => row.id))
    try {
      await this.createFavorites({ customer_id: customerId, product_id: productId, added_at: now })
    } catch (error) {
      // Another tab or device added the same product between the check and the insert (the
      // unique index refused ours) – the row is there, so the customer's click worked.
      const [row] = await this.listFavorites(
        { customer_id: customerId, product_id: productId },
        { select: ['id'] },
      )
      if (row) return 'exists'
      throw error
    }
    return 'added'
  }

  async removeForCustomer(customerId: string, productId: string): Promise<void> {
    const rows = await this.listFavorites(
      { customer_id: customerId, product_id: productId },
      { select: ['id'] },
    )
    if (rows.length) await this.deleteFavorites(rows.map((row) => row.id))
  }

  /**
   * The browser's list joins the account in one transaction. Only the difference
   * is written – rows added meanwhile by another request are never wiped; a failure keeps the
   * old list. `invisibleProductIds` – products the shop does not show now: incoming ones are
   * dropped, the account's own rows stay hidden (a draft comes back when published again).
   */
  @InjectTransactionManager()
  async mergeForCustomer(
    customerId: string,
    incoming: FavoriteEntry[],
    invisibleProductIds: string[],
    now: Date,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<{ product_ids: string[]; trimmed: boolean }> {
    const invisible = new Set(invisibleProductIds)
    const rows = await this.listFavorites(
      { customer_id: customerId },
      { take: null },
      sharedContext,
    )
    const { entries, trimmed } = mergeFavorites(
      rows
        .filter((row) => !invisible.has(row.product_id))
        .map((row) => ({ product_id: row.product_id, added_at: new Date(row.added_at) })),
      incoming.filter((entry) => !invisible.has(entry.product_id)),
      now,
      this.options_.limit,
    )
    const target = new Map(entries.map((entry) => [entry.product_id, entry]))
    const byProduct = new Map(rows.map((row) => [row.product_id, row]))
    // Only visible rows above the limit go; hidden rows are left alone.
    const gone = rows
      .filter((row) => !invisible.has(row.product_id) && !target.has(row.product_id))
      .map((row) => row.id)
    const changed = entries.flatMap((entry) => {
      const row = byProduct.get(entry.product_id)
      return row && new Date(row.added_at).getTime() !== entry.added_at.getTime()
        ? [{ id: row.id, added_at: entry.added_at }]
        : []
    })
    const added = entries
      .filter((entry) => !byProduct.has(entry.product_id))
      .map((entry) => ({
        customer_id: customerId,
        product_id: entry.product_id,
        added_at: entry.added_at,
      }))
    if (gone.length) await this.deleteFavorites(gone, sharedContext)
    if (changed.length) await this.updateFavorites(changed, sharedContext)
    if (added.length) await this.createFavorites(added, sharedContext)
    return { product_ids: entries.map((entry) => entry.product_id), trimmed }
  }

  /** Drops products the shop no longer shows. */
  async pruneForCustomer(customerId: string, keepProductIds: string[]): Promise<void> {
    const keep = new Set(keepProductIds)
    const rows = await this.listFavorites(
      { customer_id: customerId },
      { select: ['id', 'product_id'], take: null },
    )
    const gone = rows.filter((row) => !keep.has(row.product_id)).map((row) => row.id)
    if (gone.length) await this.deleteFavorites(gone)
  }

  async removeAllForCustomer(customerId: string): Promise<void> {
    const rows = await this.listFavorites(
      { customer_id: customerId },
      { select: ['id'], take: null },
    )
    if (rows.length) await this.deleteFavorites(rows.map((row) => row.id))
  }
}

export default FavoriteModuleService

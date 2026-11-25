import {
  type ArticleSummary,
  mapArticle,
  mapArticleCategory,
  mapArticleSummary,
  mapPage,
} from '@cloud-house/commerce-rules'
import type { ViewContext } from '../kinds'
import { contentOptions } from '../lib/plugin-options'
import { populate } from '../lib/populate'
import { modifiedAt } from '../lib/store-views'
import type { EntryData, EntryRow } from '../types'

type Item = { row: EntryRow; data: EntryData }

/** Data of the item with the documents it points at filled in (the default view of a kind). */
export const populated = (item: Item, ctx: ViewContext) =>
  populate(ctx.registry, item.row.type, item.row.slug, item.data, ctx.lookups)

export const pageView = (item: Item, ctx: ViewContext) =>
  mapPage(populated(item, ctx) as Parameters<typeof mapPage>[0])

export const articleView = (item: Item, ctx: ViewContext) =>
  mapArticle({ ...populated(item, ctx), updatedAt: modifiedAt(item.row) })

export const articleSummary = (item: Item, ctx: ViewContext): ArticleSummary =>
  mapArticleSummary(populated(item, ctx))

export const categoryView = (item: Item) =>
  mapArticleCategory({ ...item.data, slug: item.data.slug })

/** What a kind's view needs, for the store routes. */
export function viewContext(
  container: ViewContext['container'],
  draft: boolean,
  lookups: ViewContext['lookups'],
  entity?: ViewContext['entity'],
): ViewContext {
  return { container, registry: contentOptions(container).registry, draft, lookups, entity }
}

/** The store view of an item through the view of its kind (default: the populated data). */
export function viewOf(
  container: ViewContext['container'],
  item: Item,
  draft: boolean,
  lookups: ViewContext['lookups'],
  entity?: ViewContext['entity'],
): unknown {
  const ctx = viewContext(container, draft, lookups, entity)
  const kind = ctx.registry.get(item.row.type, item.row.slug)
  return kind?.view ? kind.view(item, ctx) : populated(item, ctx)
}

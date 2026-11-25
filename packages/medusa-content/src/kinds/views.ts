import {
  type ArticleSummary,
  mapArticle,
  mapArticleCategory,
  mapArticleSummary,
  mapPage,
} from '@cloud-house/commerce-rules'
import type { ViewContext } from '../kinds'
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

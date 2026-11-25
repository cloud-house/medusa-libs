import type { LayoutData } from '@cloud-house/commerce-rules'
import type { ContentKind } from '../kinds'
import { articleCategoryKind, articleKind } from './article'
import { type HomePageKindOptions, homePageKind } from './home'
import { announcementBarKind, footerKind, headerKind } from './layout'
import { type PageKindOptions, pageKind } from './page'
import { storeSettingsKind } from './store-settings'

export interface ContentKindsOptions extends PageKindOptions, HomePageKindOptions {
  /** What the store shows until header, announcement bar, footer and settings are saved. */
  layoutDefaults?: Partial<LayoutData>
}

/** The ready-made kinds: pages, articles and their categories, header, announcement bar, footer, store settings, home page. */
export function contentKinds(options: ContentKindsOptions = {}): ContentKind[] {
  const layout = options.layoutDefaults ?? {}
  return [
    pageKind(options),
    articleKind(),
    articleCategoryKind(),
    headerKind({ defaults: layout.navigation }),
    announcementBarKind({ defaults: layout.announcement }),
    footerKind({ defaults: layout.footer }),
    storeSettingsKind({ defaults: layout.settings }),
    homePageKind(options),
  ]
}

export * from './article'
export {
  checked,
  httpUrl,
  lexical,
  mediaRef,
  optionalText,
  productRef,
  requiredText,
  rows,
} from './common'
export type { HomePageKindOptions } from './home'
export {
  type HomeBlockDefinition,
  homeBlockBase,
  homeOptionalLink,
  homePageKind,
  homeText,
  requiredMedia,
} from './home'
export * from './layout'
export { type LexicalRules, lexicalLinkError } from './lexical-rules'
export * from './page'
export * from './store-settings'
export { articleSummary, articleView, categoryView, pageView, populated } from './views'

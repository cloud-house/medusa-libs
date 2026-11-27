import { type ResolvedSeoConfig, resolveConfig, type SeoConfig } from './config'
import { createSiteUrl } from './site'

/** SEO sklepu: wszystkie funkcje związane z jedną konfiguracją. */
export function createSeo(config: SeoConfig) {
  const resolved: ResolvedSeoConfig = resolveConfig(config)
  const site = createSiteUrl(resolved.devSiteUrl)
  return { config: resolved, ...site }
}

export type Seo = ReturnType<typeof createSeo>

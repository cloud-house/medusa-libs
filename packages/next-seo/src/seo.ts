import { type ResolvedSeoConfig, resolveConfig, type SeoConfig } from './config'
import { createJsonLd } from './json-ld'
import { createMerchantFeed } from './merchant-feed'
import { createBuildRobots } from './robots'
import { createSiteUrl } from './site'
import { createBuildSitemap } from './sitemap'
import { createSocialMetadata, shareImage } from './social'

/** SEO sklepu: wszystkie funkcje związane z jedną konfiguracją. */
export function createSeo(config: SeoConfig) {
  const resolved: ResolvedSeoConfig = resolveConfig(config)
  const site = createSiteUrl(resolved.devSiteUrl)
  return {
    config: resolved,
    ...site,
    productCanonical: resolved.routes.product,
    brandCanonical: resolved.routes.brand,
    defaultShareImage: resolved.defaultShareImage,
    shareImage,
    socialMetadata: createSocialMetadata(resolved),
    buildRobots: createBuildRobots(site),
    buildSitemap: createBuildSitemap(site),
    ...createJsonLd(resolved, site),
    buildMerchantFeed: createMerchantFeed(resolved, site),
  }
}

export type Seo = ReturnType<typeof createSeo>

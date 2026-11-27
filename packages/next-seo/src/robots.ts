import type { SiteUrl } from './site'

/** `robots.txt` – kształt zgodny z `MetadataRoute.Robots` z Next. */
export interface SeoRobots {
  rules: { userAgent: string; allow?: string[]; disallow: string | string[] }
  sitemap?: string
}

/** Indeksowanie tylko z `SITE_INDEXABLE=true`; listy ścieżek podaje sklep. */
export function createBuildRobots(site: SiteUrl) {
  return function buildRobots({
    allow,
    disallow,
  }: {
    allow: string[]
    disallow: string[]
  }): SeoRobots {
    if (!site.siteIndexable()) return { rules: { userAgent: '*', disallow: '/' } }
    return {
      rules: { userAgent: '*', allow, disallow },
      sitemap: site.absoluteUrl('/sitemap.xml'),
    }
  }
}

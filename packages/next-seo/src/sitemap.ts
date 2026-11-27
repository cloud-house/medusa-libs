import type { SiteUrl } from './site'

/** Wpis mapy strony – kształt zgodny z `MetadataRoute.Sitemap[number]` z Next. */
export interface SeoSitemapEntry {
  url: string
  lastModified?: string
}

/**
 * Mapa strony: ścieżki sklepu jako adresy absolutne, w podanej kolejności, każdy adres raz. Które
 * strony trafiają do mapy (bez filtrów, wariantów i stron prywatnych), decyduje sklep.
 */
export function createBuildSitemap(site: SiteUrl) {
  return function buildSitemap(
    entries: { path: string; lastModified?: string }[],
  ): SeoSitemapEntry[] {
    const seen = new Set<string>()
    const result: SeoSitemapEntry[] = []
    for (const { path, lastModified } of entries) {
      const url = site.absoluteUrl(path)
      if (seen.has(url)) continue
      seen.add(url)
      result.push(lastModified ? { url, lastModified } : { url })
    }
    return result
  }
}

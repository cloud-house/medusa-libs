export interface CachedInitOptions {
  tags: string[]
  /** Seconds. */
  revalidate: number
  /** Header carrying the cached-shape version, e.g. `x-shop-api-version`. */
  versionHeader?: string
  version?: number
}

export type CachedRequestInit = RequestInit & {
  cache: 'force-cache'
  next: { tags: string[]; revalidate: number }
}

/**
 * `fetch` init for the Next data cache. The version goes in a header the backend ignores: the
 * `fetch` cache key includes headers, so bumping the version drops entries of an old shape.
 */
export function cachedInit(options: CachedInitOptions): CachedRequestInit {
  const { tags, revalidate, versionHeader, version } = options
  return {
    ...(versionHeader && version !== undefined
      ? { headers: { [versionHeader]: String(version) } }
      : {}),
    cache: 'force-cache',
    next: { tags, revalidate },
  }
}

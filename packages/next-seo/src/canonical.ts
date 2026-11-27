/** Adresy kanoniczne – względne, `metadataBase` w Next robi z nich absolutne. */

export function categoryCanonical(route: { root: string; child?: string }): string {
  return route.child ? `/${route.root}/${encodeURIComponent(route.child)}` : `/${route.root}`
}

/** Strony z prawdziwą paginacją (np. poradnik) – każda jest własnym adresem kanonicznym. */
export function pagedCanonical(path: string, page: number): string {
  return page > 1 ? `${path}?strona=${page}` : path
}

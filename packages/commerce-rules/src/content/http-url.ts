/** Optional link rendered in the storefront – only http(s), never `javascript:` and the like. */
export function validateHttpUrl(value: string | null | undefined): true | string {
  if (!value?.trim()) return true
  try {
    const { protocol } = new URL(value.trim())
    if (protocol === 'https:' || protocol === 'http:') return true
  } catch {}
  return 'Podaj pełny adres zaczynający się od https://.'
}

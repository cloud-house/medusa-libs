/** Next.js ignores longer tags (`NEXT_CACHE_TAG_MAX_LENGTH`). */
export const MAX_TAG_LENGTH = 256

/**
 * Builds `kind:handle` tags. Handles may contain letters of any script (Medusa keeps
 * `wiosło-karbonowe`) and category handles are not validated at all, so the handle is
 * URI-encoded: every tag stays in a narrow ASCII alphabet.
 */
export const tagFor = (kind: string) => (handle: string) => `${kind}:${encodeURIComponent(handle)}`

/** Plain tags every shop built on the kit uses. */
export const KIT_TAGS = { catalog: 'catalog', promotions: 'promotions' } as const

/** Tag kinds (`kind:handle`) the kit knows about. */
export const KIT_TAG_KINDS = ['product', 'category', 'brand'] as const

export const productTag = tagFor('product')
export const categoryTag = tagFor('category')
export const brandTag = tagFor('brand')

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Allowlist of cache tags: exact `tags`, or `kind:` plus an encoded handle for a listed `kind`.
 * Used by the revalidation endpoint to reject unknown or oversized tags.
 */
export function createTagRules(options: { tags: readonly string[]; kinds: readonly string[] }): {
  isAllowedTag(tag: string): boolean
} {
  const tags = new Set(options.tags)
  const kinds = options.kinds.map(escapeRegExp)
  const kindPattern = kinds.length
    ? new RegExp(`^(?:${kinds.join('|')}):[A-Za-z0-9\\-_.!~*'()%]+$`)
    : null
  return {
    isAllowedTag(tag: string): boolean {
      if (tag.length > MAX_TAG_LENGTH) return false
      return tags.has(tag) || (kindPattern?.test(tag) ?? false)
    },
  }
}

export const isKitTagAllowed = createTagRules({
  tags: Object.values(KIT_TAGS),
  kinds: KIT_TAG_KINDS,
}).isAllowedTag

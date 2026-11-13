import { revalidateTag } from 'next/cache.js'

const OUTSIDE_NEXT = 'static generation store missing'

/**
 * Purges cache tags right away (webhook `/api/revalidate` from Medusa). Ignores only the error
 * thrown outside a Next request (Vitest, scripts) – a purge never fails the caller.
 */
export function revalidateTags(tags: (string | null | undefined | false)[]): string[] {
  const unique = [...new Set(tags.filter((tag): tag is string => Boolean(tag)))]
  for (const tag of unique) {
    try {
      revalidateTag(tag, { expire: 0 })
    } catch (error) {
      if (!(error instanceof Error && error.message.includes(OUTSIDE_NEXT))) throw error
    }
  }
  return unique
}

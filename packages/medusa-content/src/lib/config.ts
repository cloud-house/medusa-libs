type Env = Record<string, string | undefined>

const trimmed = (value: string | undefined) => value?.trim() || undefined

/** Startup warnings for the content setup (printed by `medusa-config.ts` outside tests). */
export function contentWarnings(env: Env, prefix = 'Treści:'): string[] {
  const warnings: string[] = []
  if (!trimmed(env.CONTENT_PREVIEW_SECRET)) {
    warnings.push(`${prefix} brak CONTENT_PREVIEW_SECRET – podgląd szkiców w sklepie nie działa.`)
  }
  if (!trimmed(env.STOREFRONT_URL)) {
    warnings.push(`${prefix} brak STOREFRONT_URL – panel nie zbuduje linku do podglądu.`)
  }
  return warnings
}

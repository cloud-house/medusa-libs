import { timingSafeEqual } from 'node:crypto'
import { isKitTagAllowed } from '@cloud-house/commerce-rules'
import { revalidateTags } from './revalidate'

export const MAX_TAGS = 100

export interface RevalidateRouteMessages {
  /** 401 body. */
  unauthorized: string
  /** 400 body. */
  invalidTags(max: number): string
  /** Log line when the secret env var is unset. */
  secretMissing(secretEnv: string): string
}

export type RevalidateRouteLocale = 'pl' | 'en'

export const REVALIDATE_ROUTE_MESSAGES: Record<RevalidateRouteLocale, RevalidateRouteMessages> = {
  pl: {
    unauthorized: 'Nieprawidłowy sekret.',
    invalidTags: (max) => `Podaj od 1 do ${max} dozwolonych tagów w polu „tags”.`,
    secretMissing: (secretEnv) => `Brak ${secretEnv} – webhook rewalidacji jest wyłączony.`,
  },
  en: {
    unauthorized: 'Invalid secret.',
    invalidTags: (max) => `Provide 1 to ${max} allowed tags in the "tags" field.`,
    secretMissing: (secretEnv) => `${secretEnv} is not set – the revalidation webhook is disabled.`,
  },
}

export interface RevalidateRouteOptions {
  /** Env var holding the shared secret. Default `REVALIDATE_SECRET`. */
  secretEnv?: string
  /** Request header carrying the secret. Default `x-revalidate-secret`. */
  header?: string
  /** Default: the kit's allowlist (`isKitTagAllowed`). */
  isAllowedTag?: (tag: string) => boolean
  messages?: Partial<RevalidateRouteMessages>
  /** Default `pl`. */
  locale?: RevalidateRouteLocale
  /** Prefix of the log line. Default `next-medusa`. */
  logPrefix?: string
}

/** Drops the keys whose value is `undefined`, so an unset override never wipes a default. */
const withoutUndefined = <T extends object>(values: T | undefined): Partial<T> =>
  Object.fromEntries(
    Object.entries(values ?? {}).filter(([, value]) => value !== undefined),
  ) as Partial<T>

/** Webhook from Medusa: purges the given cache tags. Export the result as a route handler. */
export function createRevalidateRoute(options: RevalidateRouteOptions = {}): {
  POST(request: Request): Promise<Response>
} {
  const secretEnv = options.secretEnv ?? 'REVALIDATE_SECRET'
  const header = options.header ?? 'x-revalidate-secret'
  const isAllowedTag = options.isAllowedTag ?? isKitTagAllowed
  const logPrefix = options.logPrefix ?? 'next-medusa'
  const messages = {
    ...REVALIDATE_ROUTE_MESSAGES[options.locale ?? 'pl'],
    ...withoutUndefined(options.messages),
  }

  function secretMatches(given: string | null): boolean {
    const expected = process.env[secretEnv]
    if (!expected) {
      console.error(`[${logPrefix}] ${messages.secretMissing(secretEnv)}`)
      return false
    }
    if (!given) return false
    const a = Buffer.from(given)
    const b = Buffer.from(expected)
    return a.length === b.length && timingSafeEqual(a, b)
  }

  async function readTags(request: Request): Promise<string[] | null> {
    try {
      const body: unknown = await request.json()
      const tags = (body as { tags?: unknown } | null)?.tags
      if (!Array.isArray(tags) || tags.length === 0 || tags.length > MAX_TAGS) return null
      return tags.every((tag) => typeof tag === 'string' && isAllowedTag(tag)) ? tags : null
    } catch {
      return null
    }
  }

  return {
    async POST(request) {
      if (!secretMatches(request.headers.get(header))) {
        return Response.json({ error: messages.unauthorized }, { status: 401 })
      }
      const tags = await readTags(request)
      if (!tags) {
        return Response.json({ error: messages.invalidTags(MAX_TAGS) }, { status: 400 })
      }
      return Response.json({ revalidated: revalidateTags(tags) })
    },
  }
}

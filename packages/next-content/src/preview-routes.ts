import { previewTarget, verifyPreviewToken } from '@cloud-house/commerce-rules'
import { cookies, draftMode } from 'next/headers.js'

export interface PreviewRoutesOptions {
  cookieName: string
  /** Default `CONTENT_PREVIEW_SECRET`. */
  secretEnv?: string
  messages?: Partial<{ expired: string; invalidTarget: string }>
}

const DEFAULT_MESSAGES = {
  expired: 'Podgląd wygasł albo link jest nieprawidłowy – otwórz go ponownie z panelu.',
  invalidTarget: 'Nieprawidłowy adres strony.',
}

/**
 * Route handlers for the preview link of the panel: `enter.GET` (link with a signed token) and
 * `exit.POST` (the "leave preview" form). The token proves the editor; without a valid one
 * nothing is enabled, so a link never shows a draft to a stranger.
 */
export function createPreviewRoutes({
  cookieName,
  secretEnv = 'CONTENT_PREVIEW_SECRET',
  messages,
}: PreviewRoutesOptions) {
  const text = { ...DEFAULT_MESSAGES, ...stripUndefined(messages) }

  async function GET(request: Request): Promise<Response> {
    const params = new URL(request.url).searchParams
    const token = params.get('token')
    const claims = await verifyPreviewToken(token, process.env[secretEnv])
    if (!claims || !token) return new Response(text.expired, { status: 401 })
    const target = previewTarget(params.get('slug'), params.get('collection'))
    if (!target) return new Response(text.invalidTarget, { status: 400 })

    ;(await draftMode()).enable()
    ;(await cookies()).set(cookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: new Date(claims.exp * 1000),
    })
    return redirectTo(target, 307)
  }

  async function POST(request: Request): Promise<Response> {
    const form = await request.formData().catch(() => null)
    const slug = form?.get('slug')
    const collection = form?.get('collection')
    ;(await draftMode()).disable()
    ;(await cookies()).delete(cookieName)
    const target =
      previewTarget(
        typeof slug === 'string' ? slug : null,
        typeof collection === 'string' ? collection : null,
      ) ?? '/'
    return redirectTo(target, 303)
  }

  return { enter: { GET }, exit: { POST } }
}

/**
 * Relative `Location`, like Next's own `redirect()`: `request.url` of a route handler is built from
 * the server's listen address (e.g. `0.0.0.0:3000` behind a proxy), not the public host. Not
 * `redirect()` from next/navigation either: its `.js` specifier is not aliased for route handlers
 * and breaks the Turbopack build.
 */
function redirectTo(target: string, status: 303 | 307): Response {
  return new Response(null, { status, headers: { Location: target } })
}

function stripUndefined<T extends object>(value: T | undefined): Partial<T> {
  return Object.fromEntries(
    Object.entries(value ?? {}).filter(([, v]) => v !== undefined),
  ) as Partial<T>
}

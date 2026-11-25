import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { furgonetkaConfig } from '../../../../lib/config'
import { prefixedLogger } from '../../../../lib/log'
import { finishConnect } from '../../../../lib/tokens'

const text = (value: unknown) => (typeof value === 'string' ? value : '')

/**
 * Where Furgonetka sends the operator back after the login (`redirect_uri`). It is a plain browser
 * navigation, so it carries the admin session cookie, not a bearer token – the panel is served by
 * the backend itself (`/app`), and the session cookie is `SameSite=Lax`, which a top-level GET
 * navigation includes. The route is left under the standard `/admin/*` authentication.
 * The answer is a redirect back to the settings page, with the outcome in the query.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const config = furgonetkaConfig(process.env)
  const back = (outcome: 'ok' | 'error') =>
    res.redirect(302, `${config?.adminUrl ?? '/app'}/settings/wysylka?furgonetka=${outcome}`)

  const code = text(req.query.code)
  const state = text(req.query.state)
  if (!config || !code || !state) return back('error')
  try {
    await finishConnect(req.scope, config, code, state, new Date())
  } catch (error) {
    prefixedLogger(req.scope).warn(
      `Powrót z Furgonetki odrzucony: ${error instanceof Error ? error.message : String(error)}`,
    )
    return back('error')
  }
  back('ok')
}

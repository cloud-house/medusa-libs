import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { accountsOptions } from '../../lib/plugin-options'

/** A path as the guards compare it: no trailing slashes, lower case (Express routing ignores both). */
function normalizedPath(path: string): string {
  return path.replace(/\/+$/, '').toLowerCase()
}

/**
 * The path of a request the way Express routes it, for comparing with a fixed path: the mount
 * point plus the rest, both taken from Express's own parse of the request line (`parseurl`, which
 * reads an absolute-form target such as `http:///store/returns` or `http://h:99999999/store/returns`
 * with the legacy `url.parse`, unlike the WHATWG `URL`). Medusa's handlers sit on the Express app,
 * so a guard that read the path in any other way could be walked around by a spelling Express
 * routes but the guard reads differently: `/store/RETURNS`, `/store/returns#x`, `http:///…`.
 * The result has its trailing slashes dropped and is lower-cased, like the guarded paths. A request
 * without a parsed `path` still has its `baseUrl` (the mount Express matched, which for a guard
 * registered on an exact path is that path), so it is compared by that; only a request with
 * neither gives `''`, which matches no guarded path.
 */
export function routedPath(req: Pick<MedusaRequest, 'baseUrl' | 'path'>): string {
  return normalizedPath(`${req.baseUrl ?? ''}${req.path ?? ''}`)
}

const CUSTOMER_PATHS = new Set(['/store/customers', '/store/customers/me'])

/**
 * The plugin keeps account state (`sessions_valid_from`, `last_cart_id`) in customer metadata.
 * Registered without `method`, so Express mounts it as a prefix – only the two exact paths count.
 */
export function rejectCustomerMetadata(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  const body = req.body as Record<string, unknown> | undefined
  if (req.method === 'POST' && CUSTOMER_PATHS.has(routedPath(req)) && body && 'metadata' in body) {
    res.status(400).json({
      type: 'invalid_data',
      message: accountsOptions(req.scope).messages.metadataUnavailable,
    })
    return
  }
  next()
}

/** Medusa's own verification routes – e-mail confirmation goes only through `/store/account/*`. */
export function verificationDisabled(req: MedusaRequest, res: MedusaResponse) {
  res.status(404).json({ type: 'not_found', message: accountsOptions(req.scope).messages.notFound })
}

/**
 * Exact paths closed for good: Medusa's own customer registration (any e-mail, no confirmation –
 * accounts register through `/store/account/register`); a shop can close more of its own (e.g.
 * `closedRoutes(['/store/returns'])`). Registered without `method`, so it runs before Medusa's
 * middlewares – the path is checked here, by `routedPath`.
 */
export function closedRoutes(paths: string[]) {
  const closed = new Set(paths.map(normalizedPath))
  return (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    if (req.method === 'POST' && closed.has(routedPath(req))) {
      res
        .status(404)
        .json({ type: 'not_found', message: accountsOptions(req.scope).messages.notFound })
      return
    }
    next()
  }
}

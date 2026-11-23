import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http'
import { Modules } from '@medusajs/framework/utils'
import { accountsOptions } from '../../lib/plugin-options'

/** Customer metadata: tokens issued (`iat`, seconds) before this moment are rejected. */
export const SESSIONS_VALID_FROM = 'sessions_valid_from'

/** Medusa never revokes a JWT – a password change or reset ends older sessions with this check. */
export function isStaleToken(iat: number | undefined, validFrom: unknown): boolean {
  if (typeof validFrom !== 'number') return false
  return iat === undefined || iat < validFrom
}

/**
 * Runs after Medusa's store authentication (it fills `req.auth_context` for a valid token).
 * A request without a customer token passes – routes that need one authenticate on their own.
 */
export async function sessionGuard(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  const context = (req as AuthenticatedMedusaRequest).auth_context as
    | (AuthenticatedMedusaRequest['auth_context'] & { iat?: number })
    | undefined
  if (context?.actor_type !== 'customer' || !context.actor_id) {
    next()
    return
  }
  const [customer] = await req.scope
    .resolve(Modules.CUSTOMER)
    .listCustomers({ id: context.actor_id }, { select: ['id', 'metadata'] })
  // A deleted account (soft-deleted customers are not listed) ends its sessions too.
  if (!customer || isStaleToken(context.iat, customer.metadata?.[SESSIONS_VALID_FROM])) {
    res
      .status(401)
      .json({ type: 'unauthorized', message: accountsOptions(req.scope).messages.sessionExpired })
    return
  }
  next()
}

/**
 * A customer token is never refreshed or turned into a session: `/auth/token/refresh` would give a
 * token older than `sessions_valid_from` a fresh `iat` (and stretch the fixed 30 days). Runs after
 * Medusa's own authentication of these routes, so `auth_context` is known.
 */
export function rejectCustomerTokens(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  if ((req as AuthenticatedMedusaRequest).auth_context?.actor_type === 'customer') {
    res
      .status(404)
      .json({ type: 'not_found', message: accountsOptions(req.scope).messages.notFound })
    return
  }
  next()
}

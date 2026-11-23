import type { MedusaContainer } from '@medusajs/framework/types'
import { Modules } from '@medusajs/framework/utils'
import type { AccountEmailKind, EmailThrottle } from './types'

/** Default throttle: at most this many account e-mails of one kind to one address in the window. */
export const ACCOUNT_EMAIL_LIMIT: EmailThrottle = { max: 3, windowMs: 15 * 60 * 1000 }

/**
 * Medusa's own endpoints have no rate limit, so mail bombing a customer with a password reset or
 * an e-mail confirmation stops here – per recipient, independent of the client IP.
 */
export async function tooManyAccountEmails(
  container: MedusaContainer,
  to: string,
  template: AccountEmailKind,
  throttle: EmailThrottle = ACCOUNT_EMAIL_LIMIT,
  now = Date.now(),
): Promise<boolean> {
  const recent = await container
    .resolve(Modules.NOTIFICATION)
    .listNotifications({ to, template }, { order: { created_at: 'DESC' }, take: throttle.max })
  if (recent.length < throttle.max) return false
  const oldest = recent[recent.length - 1]?.created_at
  return Boolean(oldest) && now - new Date(oldest as Date).getTime() < throttle.windowMs
}

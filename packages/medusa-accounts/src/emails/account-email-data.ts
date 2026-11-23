import type { ShopContact } from '@cloud-house/medusa-emails'
import type { MedusaContainer } from '@medusajs/framework/types'
import type { ResolvedAccountsOptions } from '../options'
import type { AccountEmailData } from './types'

/** Used when neither `options.storefrontUrl` nor `STOREFRONT_URL` is set (local development). */
export const DEFAULT_STOREFRONT_URL = 'http://localhost:3200'

/** Reply-To of the account e-mails: `EMAIL_REPLY_TO`, else the shop contact e-mail. */
export const replyToFor = (
  env: Record<string, string | undefined>,
  contact: ShopContact | null,
): string | null => env.EMAIL_REPLY_TO || contact?.email || null

/**
 * Ready-to-send account e-mail: the shop contact from `options.resolveContact` (a failing resolver
 * means the e-mail goes without it) and the link `<storefront><path>`.
 */
export async function accountEmailData(
  container: MedusaContainer,
  options: ResolvedAccountsOptions,
  logger: { warn(message: string): void },
  input: { email: string; firstName: string | null; path: string; orderNumber?: number | null },
): Promise<{ data: AccountEmailData; replyTo: string | null }> {
  let contact: ShopContact | null = null
  if (options.resolveContact) {
    try {
      contact = await options.resolveContact(container)
    } catch (error) {
      const message = (error as { message?: unknown } | null)?.message ?? error
      logger.warn(`[medusa-accounts] Shop contact could not be read: ${String(message)}`)
    }
  }
  const replyTo = replyToFor(process.env, contact)
  const shopUrl = options.storefrontUrl ?? DEFAULT_STOREFRONT_URL
  return {
    replyTo,
    data: {
      email: input.email,
      firstName: input.firstName,
      actionUrl: `${shopUrl}${input.path}`,
      contact: {
        canReply: Boolean(replyTo),
        email: contact?.email ?? null,
        phone: contact?.phone ?? null,
        hours: contact?.hours ?? null,
      },
      seller: contact?.seller ?? null,
      shopUrl,
      orderNumber: input.orderNumber ?? null,
    },
  }
}

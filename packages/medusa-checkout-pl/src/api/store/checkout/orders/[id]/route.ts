import type { CheckoutOrderResponse } from '@cloud-house/commerce-rules'
import { PASSWORD_PENDING } from '@cloud-house/medusa-accounts'
import type { MedusaResponse, MedusaStoreRequest } from '@medusajs/framework/http'
import type { MedusaContainer } from '@medusajs/framework/types'
import { Modules } from '@medusajs/framework/utils'
import { loadOrderSummary } from '../../../../../lib/order-summary'

/**
 * Login administratora Medusy z tym e-mailem (wspólny `emailpass`, spec 5a część 2 §3 pkt 15).
 * Tożsamość bez `user_id` to konto z kasy w trakcie zakładania – klient powstaje chwilę później.
 */
async function isAdminLogin(container: MedusaContainer, email: string): Promise<boolean> {
  const auth = container.resolve(Modules.AUTH)
  const providers = await auth.listProviderIdentities({ entity_id: email, provider: 'emailpass' })
  if (!providers.length) return false
  const identities = await auth.listAuthIdentities(
    { id: providers.map((provider) => provider.auth_identity_id as string) },
    { select: ['id', 'app_metadata'] },
  )
  return identities.some((identity) => typeof identity.app_metadata?.user_id === 'string')
}

/** Confirmation page order: full only with `?cart_id=` of the cart it came from (spec 3b §4.7). */
export async function GET(req: MedusaStoreRequest, res: MedusaResponse) {
  const cartId = typeof req.query.cart_id === 'string' ? req.query.cart_id : undefined
  const order = await loadOrderSummary(req.scope, req.params.id as string, cartId)
  if (!order) {
    res.status(404).json({ type: 'not_found', message: 'Nie znaleziono zamówienia.' })
    return
  }
  // Full view only: the confirmation page offers „Załóż konto” when the e-mail has no account yet.
  const email = 'email' in order ? order.email?.trim().toLowerCase() : null
  if (!email) {
    res.json({ order } satisfies CheckoutOrderResponse)
    return
  }
  const [account] = await req.scope
    .resolve(Modules.CUSTOMER)
    .listCustomers({ email, has_account: true }, { select: ['id', 'metadata'] })
  const pending = account?.metadata?.[PASSWORD_PENDING] === true
  const otherLogin = !account && (await isAdminLogin(req.scope, email))
  const metadata = (order as { metadata?: Record<string, unknown> | null }).metadata
  res.json({
    order,
    has_account: (Boolean(account) && !pending) || otherLogin,
    account_pending: pending,
    create_account: metadata?.create_account === 'tak',
  } satisfies CheckoutOrderResponse)
}

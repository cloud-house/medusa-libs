import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { Modules } from '@medusajs/framework/utils'
import { transferCartCustomerWorkflow } from '@medusajs/medusa/core-flows'
import { updateAccountMetadata } from '../../../../lib/account'
import { ACCOUNT_CART_FLAG, LAST_CART } from '../../../../lib/constants'
import { accountsOptions } from '../../../../lib/plugin-options'
import type { StoreAccountCartType } from '../validators'

async function openCart(req: AuthenticatedMedusaRequest, cartId: string) {
  const [cart] = await req.scope
    .resolve(Modules.CART)
    .listCarts({ id: cartId }, { select: ['id', 'customer_id', 'completed_at', 'metadata'] })
  return cart && !cart.completed_at ? cart : null
}

/**
 * The browser's cart belongs to the signed-in customer. The flag tells the order rule that the
 * customer attached it – not Medusa matching the e-mail.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<StoreAccountCartType>,
  res: MedusaResponse<{ cart_id: string | null } | { type: string; message: string }>,
) {
  const customerId = req.auth_context.actor_id
  const { cart_id } = req.validatedBody
  const cart = await openCart(req, cart_id)
  if (!cart) {
    res
      .status(404)
      .json({ type: 'not_found', message: accountsOptions(req.scope).messages.cartNotFound })
    return
  }
  if (cart.customer_id !== customerId) {
    await transferCartCustomerWorkflow(req.scope).run({
      input: { id: cart_id, customer_id: customerId },
    })
  }
  await req.scope.resolve(Modules.CART).updateCarts(cart_id, {
    metadata: { ...(cart.metadata ?? {}), [ACCOUNT_CART_FLAG]: customerId },
  })
  await updateAccountMetadata(req.scope, customerId, { [LAST_CART]: cart_id })
  res.json({ cart_id })
}

/** The customer's last open cart, e.g. from another device. */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse<{ cart_id: string | null }>,
) {
  const [customer] = await req.scope
    .resolve(Modules.CUSTOMER)
    .listCustomers({ id: req.auth_context.actor_id }, { select: ['id', 'metadata'] })
  const last = customer?.metadata?.[LAST_CART]
  const cart = typeof last === 'string' ? await openCart(req, last) : null
  res.json({ cart_id: cart ? cart.id : null })
}

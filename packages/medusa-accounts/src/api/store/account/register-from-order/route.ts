import type { MedusaResponse, MedusaStoreRequest } from '@medusajs/framework/http'
import { registerFromOrderWorkflow } from '../../../../workflows/account/register-from-order'
import type { StoreAccountRegisterFromOrderType } from '../validators'

/** Account from the order confirmation – the order joins it at once. */
export async function POST(
  req: MedusaStoreRequest<StoreAccountRegisterFromOrderType>,
  res: MedusaResponse,
) {
  const { order_id, cart_id, password } = req.validatedBody
  const { result } = await registerFromOrderWorkflow(req.scope).run({
    input: { orderId: order_id, cartId: cart_id, password },
  })
  res.status(201).json({ customer: { id: result.customerId, email: result.email } })
}

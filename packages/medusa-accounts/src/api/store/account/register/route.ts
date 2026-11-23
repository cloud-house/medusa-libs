import type { MedusaResponse, MedusaStoreRequest } from '@medusajs/framework/http'
import { registerCustomerWorkflow } from '../../../../workflows/account/register-customer'
import type { StoreAccountRegisterType } from '../validators'

/** Registration in one step; the shop signs in with e-mail and password afterwards. */
export async function POST(req: MedusaStoreRequest<StoreAccountRegisterType>, res: MedusaResponse) {
  const { result } = await registerCustomerWorkflow(req.scope).run({ input: req.validatedBody })
  res.status(201).json({ customer: { id: result.customerId, email: req.validatedBody.email } })
}

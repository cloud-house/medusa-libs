import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { Modules } from '@medusajs/framework/utils'
import { passwordMatches } from '../../../../lib/account'
import { accountsOptions } from '../../../../lib/plugin-options'
import { deleteAccountWorkflow } from '../../../../workflows/account/delete-account'
import type { StoreAccountDeleteType } from '../validators'

/** „Delete account for good” with the password. */
export async function POST(
  req: AuthenticatedMedusaRequest<StoreAccountDeleteType>,
  res: MedusaResponse,
) {
  const customerId = req.auth_context.actor_id
  const [customer] = await req.scope
    .resolve(Modules.CUSTOMER)
    .listCustomers({ id: customerId }, { select: ['id', 'email'] })
  if (
    !customer?.email ||
    !(await passwordMatches(req.scope, customer.email, req.validatedBody.password))
  ) {
    res
      .status(400)
      .json({ type: 'invalid_data', message: accountsOptions(req.scope).messages.wrongPassword })
    return
  }
  await deleteAccountWorkflow(req.scope).run({ input: { customerId } })
  res.json({ deleted: true })
}

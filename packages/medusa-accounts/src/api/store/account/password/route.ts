import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { Modules } from '@medusajs/framework/utils'
import { nowSeconds, passwordMatches, updateAccountMetadata } from '../../../../lib/account'
import { accountsOptions } from '../../../../lib/plugin-options'
import { SESSIONS_VALID_FROM } from '../../../guards/session-guard'
import type { StoreAccountPasswordType } from '../validators'

/** „Change password” – every session of the account ends, the shop signs in again. */
export async function POST(
  req: AuthenticatedMedusaRequest<StoreAccountPasswordType>,
  res: MedusaResponse,
) {
  const customerId = req.auth_context.actor_id
  const [customer] = await req.scope
    .resolve(Modules.CUSTOMER)
    .listCustomers({ id: customerId }, { select: ['id', 'email'] })
  const { current_password, new_password } = req.validatedBody
  if (!customer?.email || !(await passwordMatches(req.scope, customer.email, current_password))) {
    res.status(400).json({
      type: 'invalid_data',
      message: accountsOptions(req.scope).messages.wrongCurrentPassword,
    })
    return
  }
  const updated = await req.scope
    .resolve(Modules.AUTH)
    .updateProvider('emailpass', { entity_id: customer.email, password: new_password })
  if (!updated.success) throw new Error(updated.error ?? 'Password update failed')
  await updateAccountMetadata(req.scope, customerId, { [SESSIONS_VALID_FROM]: nowSeconds() })
  res.json({ success: true })
}

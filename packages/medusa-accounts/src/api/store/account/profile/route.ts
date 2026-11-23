import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { Modules } from '@medusajs/framework/utils'
import { isEmailConfirmed } from '../../../../lib/account'
import { accountsOptions } from '../../../../lib/plugin-options'

/** The signed-in customer with the e-mail confirmation flag. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const customerId = req.auth_context.actor_id
  const [customer] = await req.scope
    .resolve(Modules.CUSTOMER)
    .listCustomers(
      { id: customerId },
      { select: ['id', 'email', 'first_name', 'last_name', 'phone'] },
    )
  if (!customer) {
    res
      .status(401)
      .json({ type: 'unauthorized', message: accountsOptions(req.scope).messages.signInAgain })
    return
  }
  res.json({
    customer: {
      id: customer.id,
      email: customer.email,
      first_name: customer.first_name ?? null,
      last_name: customer.last_name ?? null,
      phone: customer.phone ?? null,
      email_confirmed: await isEmailConfirmed(req.scope, customer.id),
    },
  })
}

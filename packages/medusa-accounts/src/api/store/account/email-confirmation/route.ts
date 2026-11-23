import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { Modules } from '@medusajs/framework/utils'
import { tooManyAccountEmails } from '../../../../lib/account-email-throttle'
import { accountsOptions } from '../../../../lib/plugin-options'
import { requestEmailConfirmationWorkflow } from '../../../../workflows/account/request-email-confirmation'

/** „Resend the link” in the account – a new link replaces the old one. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const options = accountsOptions(req.scope)
  const [customer] = await req.scope
    .resolve(Modules.CUSTOMER)
    .listCustomers({ id: req.auth_context.actor_id }, { select: ['id', 'email'] })
  // Every send voids the previous link – too many attempts end without a new code.
  if (
    customer?.email &&
    (await tooManyAccountEmails(
      req.scope,
      customer.email,
      'email-confirmation',
      options.emailThrottle,
    ))
  ) {
    res.status(429).json({ type: 'too_many_requests', message: options.messages.tooManyRequests })
    return
  }
  const { result } = await requestEmailConfirmationWorkflow(req.scope).run({
    input: { customerId: req.auth_context.actor_id },
  })
  if (result.sent) res.status(201).json({ sent: true })
  else res.status(200).json({ sent: false, confirmed: true })
}

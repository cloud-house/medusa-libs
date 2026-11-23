import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { Modules } from '@medusajs/framework/utils'
import {
  markEmailConfirmed,
  PASSWORD_PENDING,
  updateAccountMetadata,
} from '../../../../../lib/account'
import { accountsOptions } from '../../../../../lib/plugin-options'
import { linkGuestOrdersWorkflow } from '../../../../../workflows/account/link-guest-orders'
import { SESSIONS_VALID_FROM } from '../../../../guards/session-guard'

/** After a new password from the e-mail link: tokens older than this one stop working. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { iat } = req.auth_context as typeof req.auth_context & { iat?: number }
  if (typeof iat !== 'number') {
    res.status(400).json({
      type: 'invalid_data',
      message: accountsOptions(req.scope).messages.tokenIssuedAtMissing,
    })
    return
  }
  const customerId = req.auth_context.actor_id
  const [customer] = await req.scope
    .resolve(Modules.CUSTOMER)
    .listCustomers({ id: customerId }, { select: ['id', 'metadata'] })
  // A new password from the reset link also ends an account from the checkout waiting for one.
  await updateAccountMetadata(req.scope, customerId, {
    [SESSIONS_VALID_FROM]: iat,
    [PASSWORD_PENDING]: '',
  })
  // An account from the checkout has a random password – the token came only from the reset link
  // in the e-mail, so the mailbox is confirmed and guest orders join like after „Set password”.
  if (customer?.metadata?.[PASSWORD_PENDING] === true) {
    if (await markEmailConfirmed(req.scope, customerId)) {
      await linkGuestOrdersWorkflow(req.scope).run({ input: { customerId } })
    }
  }
  res.json({ success: true })
}

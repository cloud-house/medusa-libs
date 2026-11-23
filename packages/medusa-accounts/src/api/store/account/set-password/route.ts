import { createHash } from 'node:crypto'
import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { Modules } from '@medusajs/framework/utils'
import {
  customerOfIdentity,
  EMAIL_ENTITY,
  nowSeconds,
  PASSWORD_PENDING,
  reopenAuthVerification,
  updateAccountMetadata,
} from '../../../../lib/account'
import { accountsOptions } from '../../../../lib/plugin-options'
import { linkGuestOrdersWorkflow } from '../../../../workflows/account/link-guest-orders'
import { SESSIONS_VALID_FROM } from '../../../guards/session-guard'
import type { StoreAccountSetPasswordType } from '../validators'

/**
 * „Set password” from the e-mail after an account was created at the checkout. The link is the
 * account's e-mail verification code, so it also confirms the e-mail and moves guest orders in.
 * Only accounts still waiting for a password – a normal confirmation link or an account with a
 * password changes nothing here (password reset goes through the reset link).
 */
export async function POST(
  req: MedusaRequest<StoreAccountSetPasswordType>,
  res: MedusaResponse<{ email: string; linked: number } | { type: string; message: string }>,
) {
  const expired = () =>
    res
      .status(400)
      .json({ type: 'invalid_data', message: accountsOptions(req.scope).messages.linkExpired })
  const { code, password } = req.validatedBody
  const auth = req.scope.resolve(Modules.AUTH)
  const [verification] = await auth.listAuthVerifications({
    provider_metadata: { token_hash: createHash('sha256').update(code).digest('hex') },
  } as Parameters<typeof auth.listAuthVerifications>[0])
  if (!verification?.id || verification.verified_at || verification.entity_type !== EMAIL_ENTITY) {
    return expired()
  }
  const customerId = await customerOfIdentity(req.scope, verification.auth_identity_id)
  const [customer] = customerId
    ? await req.scope
        .resolve(Modules.CUSTOMER)
        .listCustomers({ id: customerId }, { select: ['id', 'email', 'metadata'] })
    : []
  if (!customer?.email || customer.metadata?.[PASSWORD_PENDING] !== true) return expired()
  // The code is used up first: one request wins and Medusa checks the 7 days. A failed password
  // update gives it back, so the e-mailed link still works on the next try.
  try {
    await auth.confirmAuthVerification({ code, code_provider: 'token' })
  } catch {
    return expired()
  }
  try {
    const updated = await auth.updateProvider('emailpass', { entity_id: customer.email, password })
    if (!updated.success) throw new Error(updated.error ?? 'Password update failed')
  } catch (error) {
    await reopenAuthVerification(req.scope, verification.id)
    throw error
  }
  await updateAccountMetadata(req.scope, customer.id, {
    [PASSWORD_PENDING]: '',
    [SESSIONS_VALID_FROM]: nowSeconds(),
  })
  const { result } = await linkGuestOrdersWorkflow(req.scope).run({
    input: { customerId: customer.id },
  })
  res.json({ email: customer.email, linked: result.linked })
}

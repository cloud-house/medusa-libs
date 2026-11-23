import { createHash } from 'node:crypto'
import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { Modules } from '@medusajs/framework/utils'
import { accountIdentityId, EMAIL_ENTITY } from '../../../../lib/account'
import { accountsOptions } from '../../../../lib/plugin-options'
import { linkGuestOrdersWorkflow } from '../../../../workflows/account/link-guest-orders'
import type { StoreAccountConfirmEmailType } from '../validators'

/** The `token` verification provider stores `sha256(code)` as hex (`hashVerificationToken`). */
const hashOf = (code: string) => createHash('sha256').update(code).digest('hex')

/**
 * The link from „Confirm your e-mail”, confirmed by the signed-in owner of the account: the code
 * must belong to this account's verification. A link alone (a mail scanner, the mailbox owner of
 * an address someone else registered) confirms nothing – confirming moves guest orders with the
 * e-mail into the account.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<StoreAccountConfirmEmailType>,
  res: MedusaResponse<{ linked: number } | { type: string; message: string }>,
) {
  const customerId = req.auth_context.actor_id
  const expired = () =>
    res
      .status(400)
      .json({ type: 'invalid_data', message: accountsOptions(req.scope).messages.linkExpired })
  const identityId = await accountIdentityId(req.scope, customerId)
  if (!identityId) return expired()
  const auth = req.scope.resolve(Modules.AUTH)
  const verifications = await auth.listAuthVerifications({
    auth_identity_id: identityId,
    entity_type: EMAIL_ENTITY,
  })
  const hash = hashOf(req.validatedBody.code)
  const own = verifications.some(
    (verification) =>
      (verification.provider_metadata as { token_hash?: unknown } | null)?.token_hash === hash,
  )
  if (!own) return expired()
  try {
    await auth.confirmAuthVerification({ code: req.validatedBody.code, code_provider: 'token' })
  } catch {
    return expired()
  }
  const { result } = await linkGuestOrdersWorkflow(req.scope).run({ input: { customerId } })
  res.json({ linked: result.linked })
}

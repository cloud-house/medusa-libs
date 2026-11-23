import { createHash } from 'node:crypto'
import { sendEmailWorkflow } from '@cloud-house/medusa-emails/workflows/send-email'
import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import { accountEmailData } from '../emails/account-email-data'
import {
  CREATED_FROM_ORDER,
  customerOfIdentity,
  EMAIL_ENTITY,
  PASSWORD_PENDING,
} from '../lib/account'
import { accountsOptions } from '../lib/plugin-options'

type VerificationRequested = {
  entity_id: string
  entity_type: string
  auth_identity_id: string
  code?: string
}

/** `#display_id` of the order that created the account (`created_from_order`), `null` – unknown. */
async function orderNumber(container: MedusaContainer, orderId: unknown): Promise<number | null> {
  if (typeof orderId !== 'string') return null
  const [order] = await container
    .resolve(Modules.ORDER)
    .listOrders({ id: orderId }, { select: ['id', 'display_id'] })
  return order?.display_id ? Number(order.display_id) : null
}

/** Sends the „confirm your e-mail” link (Medusa has no delivery of verification codes). */
export default async function accountEmailConfirmation({
  event,
  container,
}: SubscriberArgs<VerificationRequested>) {
  const { entity_id: email, entity_type, auth_identity_id, code } = event.data
  // An already verified e-mail comes back without a code.
  if (entity_type !== EMAIL_ENTITY || !code) return
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    const customerId = await customerOfIdentity(container, auth_identity_id)
    const [customer] = customerId
      ? await container
          .resolve(Modules.CUSTOMER)
          .listCustomers({ id: customerId }, { select: ['id', 'first_name', 'metadata'] })
      : []
    // An account from the checkout has no password – the same verification code is the „set password” link.
    const setPassword = customer?.metadata?.[PASSWORD_PENDING] === true
    const template = setPassword ? 'set-password' : 'email-confirmation'
    const options = accountsOptions(container)
    const { paths } = options
    const { data, replyTo } = await accountEmailData(container, options, logger, {
      email,
      firstName: customer?.first_name ?? null,
      path: `${setPassword ? paths.setPassword : paths.confirmEmail}?kod=${encodeURIComponent(code)}`,
      orderNumber: setPassword
        ? await orderNumber(container, customer?.metadata?.[CREATED_FROM_ORDER])
        : null,
    })
    await sendEmailWorkflow(container).run({
      input: {
        template,
        to: email,
        data: data as unknown as Record<string, unknown>,
        replyTo,
        idempotencyKey: `${template}:${createHash('sha256').update(code).digest('hex').slice(0, 24)}`,
        resourceType: 'customer',
        resourceId: customerId,
        trigger: event.name,
      },
    })
  } catch (error) {
    const message = (error as { message?: unknown } | null)?.message ?? error
    logger.error(
      `[medusa-accounts] E-mail confirmation e-mail to ${email} failed: ${String(message)}`,
    )
  }
}

export const config: SubscriberConfig = { event: 'auth.verification_requested' }

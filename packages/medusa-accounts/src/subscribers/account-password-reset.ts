import { sendEmailWorkflow } from '@cloud-house/medusa-emails/workflows/send-email'
import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import { accountEmailData } from '../emails/account-email-data'
import { tooManyAccountEmails } from '../lib/account-email-throttle'
import { accountsOptions } from '../lib/plugin-options'

type PasswordReset = { entity_id: string; actor_type: string; token: string }

/** `jti` of the reset token – one e-mail per token even when the event repeats. */
function tokenId(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'))
    return typeof payload.jti === 'string' ? payload.jti : null
  } catch {
    return null
  }
}

/** Password reset e-mail – only for an existing customer account (an admin with the same e-mail gets nothing). */
export default async function accountPasswordReset({
  event,
  container,
}: SubscriberArgs<PasswordReset>) {
  const { entity_id, actor_type, token } = event.data
  if (actor_type !== 'customer') return
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const email = entity_id.trim().toLowerCase()
  try {
    const [customer] = await container
      .resolve(Modules.CUSTOMER)
      .listCustomers({ email, has_account: true }, { select: ['id', 'first_name'] })
    if (!customer) return
    const jti = tokenId(token)
    if (!jti) return
    const options = accountsOptions(container)
    if (await tooManyAccountEmails(container, email, 'password-reset', options.emailThrottle)) {
      logger.warn(
        `[medusa-accounts] Too many password reset requests for ${email} – e-mail skipped.`,
      )
      return
    }
    const { data, replyTo } = await accountEmailData(container, options, logger, {
      email,
      firstName: customer.first_name ?? null,
      path: `${options.paths.passwordReset}?token=${encodeURIComponent(token)}`,
    })
    await sendEmailWorkflow(container).run({
      input: {
        template: 'password-reset',
        to: email,
        data: data as unknown as Record<string, unknown>,
        replyTo,
        idempotencyKey: `password-reset:${jti}`,
        resourceType: 'customer',
        resourceId: customer.id,
        trigger: event.name,
      },
    })
  } catch (error) {
    const message = (error as { message?: unknown } | null)?.message ?? error
    logger.error(`[medusa-accounts] Password reset e-mail to ${email} failed: ${String(message)}`)
  }
}

export const config: SubscriberConfig = { event: 'auth.password_reset' }

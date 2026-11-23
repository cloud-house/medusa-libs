import { Modules } from '@medusajs/framework/utils'
import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
  when,
} from '@medusajs/framework/workflows-sdk'
import { requestVerificationWorkflow } from '@medusajs/medusa/core-flows'
import { accountIdentityId, EMAIL_ENTITY, isEmailConfirmed } from '../../lib/account'

type Target = { authIdentityId: string; email: string; customerId: string } | null

const emailConfirmationTargetStep = createStep(
  'email-confirmation-target',
  async ({ customerId }: { customerId: string }, { container }) => {
    const [customer] = await container
      .resolve(Modules.CUSTOMER)
      .listCustomers({ id: customerId }, { select: ['id', 'email'] })
    const authIdentityId = await accountIdentityId(container, customerId)
    if (!customer?.email || !authIdentityId) return new StepResponse(null as Target)
    if (await isEmailConfirmed(container, customerId)) return new StepResponse(null as Target)
    return new StepResponse({ authIdentityId, email: customer.email, customerId } as Target)
  },
)

/**
 * A fresh confirmation link: Medusa's `token` verification (7 days) emits
 * `auth.verification_requested` with the code, the subscriber sends the e-mail. A new request
 * replaces the earlier code – an older link stops working. An already confirmed e-mail – nothing.
 */
export const requestEmailConfirmationWorkflow = createWorkflow(
  'request-email-confirmation',
  (input: { customerId: string }) => {
    const target = emailConfirmationTargetStep(input)
    when({ target }, ({ target }) => Boolean(target)).then(() => {
      const verification = transform({ target }, ({ target }) => ({
        auth_identity_id: target?.authIdentityId as string,
        entity_id: target?.email as string,
        entity_type: EMAIL_ENTITY,
        code_provider: 'token',
        metadata: { customer_id: target?.customerId },
      }))
      requestVerificationWorkflow.runAsStep({ input: verification })
    })
    return new WorkflowResponse(transform({ target }, ({ target }) => ({ sent: Boolean(target) })))
  },
)

import type { AuthenticationInput } from '@medusajs/framework/types'
import { MedusaError, Modules } from '@medusajs/framework/utils'
import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk'
import { createCustomerAccountWorkflow } from '@medusajs/medusa/core-flows'
import { accountError } from '../../lib/account-error'
import { requestEmailConfirmationWorkflow } from './request-email-confirmation'

export interface RegisterCustomerInput {
  /** Already trimmed and lowercase. */
  email: string
  password: string
  first_name: string
  last_name: string
  phone: string
}

/** E-mail + password identity; undone when the customer cannot be created. */
export const registerIdentityStep = createStep(
  'register-customer-identity',
  async ({ email, password }: { email: string; password: string }, { container }) => {
    const result = await container
      .resolve(Modules.AUTH)
      .register('emailpass', { body: { email, password } } as AuthenticationInput)
    if (!result.success || !result.authIdentity) {
      throw accountError(container, MedusaError.Types.DUPLICATE_ERROR, 'duplicateAccount')
    }
    return new StepResponse(result.authIdentity.id, result.authIdentity.id)
  },
  async (authIdentityId, { container }) => {
    if (authIdentityId) await container.resolve(Modules.AUTH).deleteAuthIdentities([authIdentityId])
  },
)

/**
 * One request instead of Medusa's three (register → create customer → refresh): no identity is
 * left without a customer when the second step fails. The confirmation e-mail
 * goes out at the end.
 */
export const registerCustomerWorkflow = createWorkflow(
  'register-customer',
  (input: RegisterCustomerInput) => {
    const authIdentityId = registerIdentityStep(
      transform({ input }, ({ input }) => ({ email: input.email, password: input.password })),
    )
    const customer = createCustomerAccountWorkflow.runAsStep({
      input: transform({ input, authIdentityId }, ({ input, authIdentityId }) => ({
        authIdentityId,
        customerData: {
          email: input.email,
          first_name: input.first_name,
          last_name: input.last_name,
          phone: input.phone,
        },
      })),
    })
    const customerId = transform({ customer }, ({ customer }) => customer.id)
    requestEmailConfirmationWorkflow.runAsStep({
      input: transform({ customerId }, ({ customerId }) => ({ customerId })),
    })
    return new WorkflowResponse(
      transform({ customerId, authIdentityId }, ({ customerId, authIdentityId }) => ({
        customerId,
        authIdentityId,
      })),
    )
  },
)

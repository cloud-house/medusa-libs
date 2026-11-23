import { randomBytes } from 'node:crypto'
import type { AuthenticationInput } from '@medusajs/framework/types'
import { MedusaError, Modules } from '@medusajs/framework/utils'
import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
  when,
} from '@medusajs/framework/workflows-sdk'
import { createCustomerAccountWorkflow, updateOrdersStep } from '@medusajs/medusa/core-flows'
import { CREATED_FROM_ORDER, PASSWORD_PENDING } from '../../lib/account'
import { tooManyAccountEmails } from '../../lib/account-email-throttle'
import { accountError } from '../../lib/account-error'
import { accountsOptions } from '../../lib/plugin-options'
import { requestEmailConfirmationWorkflow } from './request-email-confirmation'

type Decision =
  | { kind: 'skip' }
  | { kind: 'relink'; customerId: string; throttled: boolean }
  | { kind: 'create'; email: string; first_name: string; last_name: string; phone: string }

/** What the checkout's „create an account” checkbox of this order leads to. */
export const decideCheckoutAccountStep = createStep(
  'decide-checkout-account',
  async ({ orderId }: { orderId: string }, { container }) => {
    const [order] = await container
      .resolve(Modules.ORDER)
      .listOrders(
        { id: orderId },
        { select: ['id', 'email', 'metadata'], relations: ['shipping_address'] },
      )
    const flag = accountsOptions(container).createAccountFlag
    if (!order?.email || order.metadata?.[flag.key] !== flag.value) {
      return new StepResponse({ kind: 'skip' } as Decision)
    }
    const email = order.email.trim().toLowerCase()
    const [account] = await container
      .resolve(Modules.CUSTOMER)
      .listCustomers({ email, has_account: true }, { select: ['id', 'metadata'] })
    if (account) {
      // An account with a password – the A/B/C rule handles the order; an account from the checkout – a new link.
      if (account.metadata?.[PASSWORD_PENDING] !== true) {
        return new StepResponse({ kind: 'skip' } as Decision)
      }
      // The same order again (a redelivered `order.placed`): its link is already out – a new
      // code would make the e-mailed one stop working.
      if (account.metadata?.[CREATED_FROM_ORDER] === orderId) {
        return new StepResponse({ kind: 'skip' } as Decision)
      }
      const throttled = await tooManyAccountEmails(
        container,
        email,
        'set-password',
        accountsOptions(container).emailThrottle,
      )
      return new StepResponse({ kind: 'relink', customerId: account.id, throttled } as Decision)
    }
    // A shared `emailpass` login (e.g. a Medusa admin) – never take over someone else's identity.
    const identities = await container
      .resolve(Modules.AUTH)
      .listProviderIdentities({ entity_id: email, provider: 'emailpass' })
    if (identities.length) return new StepResponse({ kind: 'skip' } as Decision)
    const address = order.shipping_address
    return new StepResponse({
      kind: 'create',
      email,
      first_name: address?.first_name ?? '',
      last_name: address?.last_name ?? '',
      phone: address?.phone ?? '',
    } as Decision)
  },
)

/**
 * Identity with a random password nobody knows – the customer sets one with the e-mail link.
 * Not `registerIdentityStep`: there the password is step
 * input, which belongs to the workflow's transaction context that Medusa can persist with the
 * execution. A password generated inside the step never enters it.
 */
export const registerCheckoutIdentityStep = createStep(
  'register-checkout-identity',
  async ({ email }: { email: string }, { container }) => {
    const result = await container.resolve(Modules.AUTH).register('emailpass', {
      body: { email, password: randomBytes(32).toString('base64url') },
    } as AuthenticationInput)
    if (!result.success || !result.authIdentity) {
      throw accountError(container, MedusaError.Types.DUPLICATE_ERROR, 'duplicateAccount')
    }
    return new StepResponse(result.authIdentity.id, result.authIdentity.id)
  },
  async (authIdentityId, { container }) => {
    if (authIdentityId) await container.resolve(Modules.AUTH).deleteAuthIdentities([authIdentityId])
  },
)

/** A later order of an account still waiting for its password: the order and the link follow it. */
export const relinkCheckoutAccountStep = createStep(
  'relink-checkout-account',
  async ({ orderId, customerId }: { orderId: string; customerId: string }, { container }) => {
    const orders = container.resolve(Modules.ORDER)
    const customers = container.resolve(Modules.CUSTOMER)
    const [order] = await orders.listOrders({ id: orderId }, { select: ['id', 'customer_id'] })
    const [customer] = await customers.listCustomers(
      { id: customerId },
      { select: ['id', 'metadata'] },
    )
    const createdFrom = customer?.metadata?.[CREATED_FROM_ORDER]
    await orders.updateOrders([{ id: orderId, customer_id: customerId }])
    await customers.updateCustomers(customerId, { metadata: { [CREATED_FROM_ORDER]: orderId } })
    return new StepResponse(undefined, {
      orderId,
      customerId,
      previousCustomerId: order?.customer_id ?? null,
      previousCreatedFrom: typeof createdFrom === 'string' ? createdFrom : null,
    })
  },
  async (undo, { container }) => {
    if (!undo) return
    await container.resolve(Modules.ORDER).updateOrders([
      // An order without a customer gets none back – the DTO type leaves out `null`.
      { id: undo.orderId, customer_id: undo.previousCustomerId as string },
    ])
    // Metadata is merged on update; `''` removes the key.
    await container.resolve(Modules.CUSTOMER).updateCustomers(undo.customerId, {
      metadata: { [CREATED_FROM_ORDER]: undo.previousCreatedFrom ?? '' },
    })
  },
)

/**
 * the checkout's „create an account” checkbox: after the order the account appears with
 * the order's name and phone, `password_pending` and a 7-day „set password” link (Medusa's `token`
 * verification). One workflow – events go out at the end, so the e-mail subscriber already sees
 * `password_pending`.
 */
export const createAccountFromCheckoutWorkflow = createWorkflow(
  'create-account-from-checkout',
  (input: { orderId: string }) => {
    const decision = decideCheckoutAccountStep(input)

    when({ decision }, ({ decision }) => decision.kind === 'create').then(() => {
      const authIdentityId = registerCheckoutIdentityStep(
        transform({ decision }, ({ decision }) => ({
          email: (decision as Extract<Decision, { kind: 'create' }>).email,
        })),
      )
      const customer = createCustomerAccountWorkflow.runAsStep({
        input: transform(
          { decision, authIdentityId, input },
          ({ decision, authIdentityId, input }) => {
            const person = decision as Extract<Decision, { kind: 'create' }>
            return {
              authIdentityId,
              customerData: {
                email: person.email,
                first_name: person.first_name,
                last_name: person.last_name,
                phone: person.phone,
                metadata: { [PASSWORD_PENDING]: true, [CREATED_FROM_ORDER]: input.orderId },
              },
            }
          },
        ),
      })
      updateOrdersStep(
        transform({ customer, input }, ({ customer, input }) => ({
          selector: { id: input.orderId },
          update: { customer_id: customer.id },
        })),
      ).config({ name: 'checkout-account-order' })
      requestEmailConfirmationWorkflow
        .runAsStep({
          input: transform({ customer }, ({ customer }) => ({ customerId: customer.id })),
        })
        .config({ name: 'checkout-account-link' })
    })

    when({ decision }, ({ decision }) => decision.kind === 'relink').then(() => {
      relinkCheckoutAccountStep(
        transform({ decision, input }, ({ decision, input }) => ({
          orderId: input.orderId,
          customerId: (decision as Extract<Decision, { kind: 'relink' }>).customerId,
        })),
      )
    })

    // Over the e-mail limit the code is not replaced – the old link keeps working.
    when({ decision }, ({ decision }) => decision.kind === 'relink' && !decision.throttled).then(
      () => {
        requestEmailConfirmationWorkflow
          .runAsStep({
            input: transform({ decision }, ({ decision }) => ({
              customerId: (decision as Extract<Decision, { kind: 'relink' }>).customerId,
            })),
          })
          .config({ name: 'checkout-account-relink-link' })
      },
    )

    return new WorkflowResponse(
      transform({ decision }, ({ decision }) => ({
        outcome:
          decision.kind === 'create'
            ? 'created'
            : decision.kind === 'relink'
              ? 'relinked'
              : 'skipped',
      })),
    )
  },
)

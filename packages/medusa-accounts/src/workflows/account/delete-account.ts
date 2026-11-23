import { Modules } from '@medusajs/framework/utils'
import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk'
import { deleteCustomersWorkflow } from '@medusajs/medusa/core-flows'
import { accountIdentityId } from '../../lib/account'
import { accountsOptions } from '../../lib/plugin-options'

/**
 * Personal data really leaves the database: Medusa's delete is soft and keeps
 * the rows. Not undone on a later failure – a half-deleted account is better than restored data;
 * the same goes for a failing `onAccountDeleted` callback: the deletion stops and the error reaches
 * the caller.
 */
export const eraseCustomerDataStep = createStep(
  'erase-customer-data',
  async ({ customerId }: { customerId: string }, { container }) => {
    const customers = container.resolve(Modules.CUSTOMER)
    const addresses = await customers.listCustomerAddresses(
      { customer_id: customerId },
      { select: ['id'] },
    )
    if (addresses.length) await customers.deleteCustomerAddresses(addresses.map((a) => a.id))
    await customers.updateCustomers(customerId, {
      first_name: null,
      last_name: null,
      phone: null,
      company_name: null,
      email: accountsOptions(container).deletedEmail(customerId),
      // The marker stays: if a later step fails, the old tokens are refused anyway.
      metadata: { sessions_valid_from: Math.floor(Date.now() / 1000) },
    })
    // Open carts of the account (e.g. on another device) hold its data, and after the soft delete
    // Medusa would not update them anyway.
    const carts = container.resolve(Modules.CART)
    const open = (
      await carts.listCarts({ customer_id: customerId }, { select: ['id', 'completed_at'] })
    )
      .filter((cart) => !cart.completed_at)
      .map((cart) => cart.id)
    if (open.length) await carts.deleteCarts(open)
    // The shop's own data of the account (e.g. favourites) goes too. A failing callback aborts the
    // deletion, see the note above.
    for (const onAccountDeleted of accountsOptions(container).onAccountDeleted) {
      await onAccountDeleted(container, customerId)
    }
    const identityId = await accountIdentityId(container, customerId)
    // Cascades to the password, the e-mail verification and reset tokens.
    if (identityId) await container.resolve(Modules.AUTH).deleteAuthIdentities([identityId])
    return new StepResponse(customerId)
  },
)

/** „Delete the account for good” – orders stay (they keep their own e-mail and addresses). */
export const deleteAccountWorkflow = createWorkflow(
  'delete-account',
  (input: { customerId: string }) => {
    const customerId = eraseCustomerDataStep(input)
    deleteCustomersWorkflow.runAsStep({
      input: transform({ customerId }, ({ customerId }) => ({ ids: [customerId] })),
    })
    return new WorkflowResponse(customerId)
  },
)

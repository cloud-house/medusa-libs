import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
  when,
} from '@medusajs/framework/workflows-sdk'
import { updateOrdersStep } from '@medusajs/medusa/core-flows'

/**
 * Orders with the account's e-mail whose customer has no account (a guest) or no longer exists
 * (a deleted account) – they belong to whoever owns the mailbox.
 */
export const findGuestOrdersStep = createStep(
  'find-guest-orders-for-account',
  async ({ customerId }: { customerId: string }, { container }) => {
    const [customer] = await container
      .resolve(Modules.CUSTOMER)
      .listCustomers({ id: customerId }, { select: ['id', 'email', 'has_account'] })
    if (!customer?.email || !customer.has_account) return new StepResponse([] as string[])

    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: 'order',
      fields: ['id', 'customer_id'],
      filters: { email: customer.email, is_draft_order: false },
    })
    const orders = data as { id: string; customer_id: string | null }[]
    const others = orders.filter((order) => order.customer_id !== customerId)
    const ownerIds = [...new Set(others.flatMap((order) => order.customer_id ?? []))]
    // Deleted customers are not listed – their orders are free to join.
    const accounts = ownerIds.length
      ? await container
          .resolve(Modules.CUSTOMER)
          .listCustomers({ id: ownerIds, has_account: true }, { select: ['id'] })
      : []
    const taken = new Set(accounts.map((account) => account.id))
    return new StepResponse(
      others
        .filter((order) => !order.customer_id || !taken.has(order.customer_id))
        .map((order) => order.id),
    )
  },
)

/** After the e-mail confirmation: guest orders with the e-mail join the account. */
export const linkGuestOrdersWorkflow = createWorkflow(
  'link-guest-orders',
  (input: { customerId: string }) => {
    const orderIds = findGuestOrdersStep(input)
    when({ orderIds }, ({ orderIds }) => orderIds.length > 0).then(() => {
      updateOrdersStep(
        transform({ orderIds, input }, ({ orderIds, input }) => ({
          selector: { id: orderIds },
          update: { customer_id: input.customerId },
        })),
      )
    })
    return new WorkflowResponse(
      transform({ orderIds }, ({ orderIds }) => ({ linked: orderIds.length })),
    )
  },
)

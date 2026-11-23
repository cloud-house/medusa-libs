import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk'
import { isEmailConfirmed, registeredCustomerByEmail } from '../../lib/account'

import { ACCOUNT_CART_FLAG } from '../../lib/constants'

async function cartFlag(container: MedusaContainer, orderId: string): Promise<unknown> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: 'order_cart',
    fields: ['cart.metadata'],
    filters: { order_id: orderId },
  })
  const cart = (data[0] as { cart?: { metadata?: Record<string, unknown> | null } } | undefined)
    ?.cart
  return cart?.metadata?.[ACCOUNT_CART_FLAG]
}

async function guestFor(container: MedusaContainer, email: string): Promise<string> {
  const customers = container.resolve(Modules.CUSTOMER)
  const [guest] = await customers.listCustomers({ email, has_account: false }, { select: ['id'] })
  if (guest) return guest.id
  return (await customers.createCustomers({ email, has_account: false })).id
}

/** Who should own a freshly placed order; `null` – leave it as Medusa set it. */
async function rightfulOwner(
  container: MedusaContainer,
  order: { id: string; email: string | null; customer_id: string | null },
): Promise<string | null> {
  if (!order.email) return null
  const [current] = order.customer_id
    ? await container
        .resolve(Modules.CUSTOMER)
        .listCustomers({ id: order.customer_id }, { select: ['id', 'has_account', 'email'] })
    : []
  const email = order.email.toLowerCase()
  const accountCart = Boolean(current?.has_account)

  if (accountCart && current?.email?.toLowerCase() === email) {
    // A: the signed-in customer attached the cart. B: Medusa matched the cart e-mail itself –
    // only a confirmed mailbox owner keeps it, otherwise anyone could register a stranger's e-mail.
    if ((await cartFlag(container, order.id)) === current.id) return null
    if (await isEmailConfirmed(container, current.id)) return null
    return guestFor(container, email)
  }

  // C: an order on the confirmed e-mail of an account joins the account. An account cart ordered
  // with another e-mail (left in a browser after the session ended) is that person's order, not
  // the account's (review I4).
  const account = await registeredCustomerByEmail(container, email)
  if (account && (await isEmailConfirmed(container, account.id))) return account.id
  return accountCart ? guestFor(container, email) : null
}

export const assignPlacedOrderStep = createStep(
  'assign-placed-order',
  async ({ orderId }: { orderId: string }, { container }) => {
    const orders = container.resolve(Modules.ORDER)
    const [order] = await orders.listOrders(
      { id: orderId },
      { select: ['id', 'email', 'customer_id'] },
    )
    if (!order) return new StepResponse(null)
    const owner = await rightfulOwner(container, {
      id: order.id,
      email: order.email ?? null,
      customer_id: order.customer_id ?? null,
    })
    if (!owner || owner === order.customer_id) return new StepResponse(null)
    await orders.updateOrders([{ id: order.id, customer_id: owner }])
    return new StepResponse(owner, { id: order.id, customer_id: order.customer_id ?? null })
  },
  async (previous, { container }) => {
    if (!previous) return
    await container
      .resolve(Modules.ORDER)
      .updateOrders([{ id: previous.id, customer_id: previous.customer_id ?? undefined }])
  },
)

/** The ownership rule for a placed order. */
export const assignPlacedOrderWorkflow = createWorkflow(
  'assign-placed-order',
  (input: { orderId: string }) => new WorkflowResponse(assignPlacedOrderStep(input)),
)

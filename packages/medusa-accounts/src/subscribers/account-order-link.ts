import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { assignPlacedOrderWorkflow } from '../workflows/account/assign-placed-order'
import { createAccountFromCheckoutWorkflow } from '../workflows/account/create-account-from-checkout'

/** Who owns a new order: account or guest; a failure never touches the order. */
export default async function accountOrderLink({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    await assignPlacedOrderWorkflow(container).run({ input: { orderId: event.data.id } })
  } catch (error) {
    logger.error(
      `[medusa-accounts] Assigning order ${event.data.id} to an account failed: ${reason(error)}`,
    )
  }
  // „Create an account” checkbox of the checkout – after the A/B/C rule, so the new account gets this order.
  try {
    await createAccountFromCheckoutWorkflow(container).run({ input: { orderId: event.data.id } })
  } catch (error) {
    logger.error(
      `[medusa-accounts] Account from the checkout of order ${event.data.id} was not created: ${reason(error)}`,
    )
  }
}

function reason(error: unknown): string {
  return String((error as { message?: unknown } | null)?.message ?? error)
}

export const config: SubscriberConfig = { event: 'order.placed' }

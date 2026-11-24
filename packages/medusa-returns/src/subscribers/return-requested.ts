import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { logPrefix } from '../lib/plugin-options'
import { sendReturnEmailsWorkflow } from '../workflows/send-return-emails'

/**
 * The e-mails about a new return (spec 6e-b §5.5) – for a claim in the shop and for a return the
 * staff confirms in the admin. A failure never touches the return.
 */
export default async function returnRequested({
  event,
  container,
}: SubscriberArgs<{ order_id: string; return_id: string }>) {
  const { order_id: orderId, return_id: returnId } = event.data
  try {
    await sendReturnEmailsWorkflow(container).run({ input: { orderId, returnId } })
  } catch (error) {
    // Workflow errors arrive as plain objects with `message`, not as `Error` instances.
    const message = (error as { message?: unknown } | null)?.message ?? error
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error(
        `${logPrefix(container)} E-maile o zwrocie ${returnId} zamówienia ${orderId} nie wyszły: ${String(message)}`,
      )
  }
}

export const config: SubscriberConfig = { event: 'order.return_requested' }

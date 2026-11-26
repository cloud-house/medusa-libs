import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { logPrefix } from '../lib/plugin-options'
import { sendOrderConfirmationWorkflow } from '../workflows/send-order-confirmation'

/** „#1001 (order_…)” – the number the customer and the admin see, with the id; the id alone if unknown. */
async function orderLabel(container: MedusaContainer, id: string): Promise<string> {
  try {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: 'order',
      fields: ['display_id'],
      filters: { id },
    })
    const displayId = (data[0] as { display_id?: number | null } | undefined)?.display_id
    return displayId ? `#${displayId} (${id})` : id
  } catch {
    return id
  }
}

/** „Dziękujemy za zamówienie” right after checkout (spec 3c); a failure never touches the order. */
export default async function orderConfirmationEmail({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  try {
    await sendOrderConfirmationWorkflow(container).run({ input: { orderId: event.data.id } })
  } catch (error) {
    // Workflow errors arrive as plain objects with `message`, not as `Error` instances.
    const message = (error as { message?: unknown } | null)?.message ?? error
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error(
        `${logPrefix(container)} E-mail z potwierdzeniem zamówienia ${await orderLabel(container, event.data.id)} nie wyszedł: ${String(message)}`,
      )
  }
}

export const config: SubscriberConfig = { event: 'order.placed' }

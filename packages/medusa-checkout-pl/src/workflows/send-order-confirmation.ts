import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
  when,
} from '@medusajs/framework/workflows-sdk'
import { sendNotificationsStep } from '@medusajs/medusa/core-flows'
import { loadOrderPlacedEmail } from '../lib/order-email'
import { logPrefix } from '../lib/plugin-options'

const prepareOrderConfirmationStep = createStep(
  'prepare-order-confirmation',
  async ({ orderId }: { orderId: string }, { container }) => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const prepared = await loadOrderPlacedEmail(container, orderId, process.env, logger)
    if (!prepared) {
      logger.info(
        `${logPrefix(container)} Zamówienie ${orderId} spoza sklepu albo bez e-maila – bez potwierdzenia.`,
      )
    }
    return new StepResponse(prepared)
  },
)

/**
 * Order confirmation e-mail (spec 3c §4.4). The idempotency key makes a repeated `order.placed`
 * after a sent e-mail a no-op in the Notification module. After a failed send Medusa 2.21 does
 * try again, but under a fresh notification id: the provider sends, then saving the status ends
 * in NOT_FOUND and the first row stays `failure`. So the provider also passes the key to Resend
 * (`Idempotency-Key`, kept 24 h) – a mail that already went out is not sent twice.
 */
export const sendOrderConfirmationWorkflow = createWorkflow(
  'send-order-confirmation',
  (input: { orderId: string }) => {
    const prepared = prepareOrderConfirmationStep(input)
    when({ prepared }, ({ prepared }) => Boolean(prepared)).then(() => {
      const notifications = transform({ prepared, input }, ({ prepared, input }) => [
        {
          to: prepared?.to as string,
          channel: 'email',
          template: 'order-placed',
          data: prepared?.data as unknown as Record<string, unknown>,
          provider_data: prepared?.replyTo ? { reply_to: prepared.replyTo } : null,
          idempotency_key: `order-placed:${input.orderId}`,
          // Ties the notification to its order (admin, later „resend” or retention passes).
          resource_type: 'order',
          resource_id: input.orderId,
          trigger_type: 'order.placed',
        },
      ])
      sendNotificationsStep(notifications)
    })
    return new WorkflowResponse(prepared)
  },
)

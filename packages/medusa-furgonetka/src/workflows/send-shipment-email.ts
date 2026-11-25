import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
  when,
} from '@medusajs/framework/workflows-sdk'
import { sendNotificationsStep } from '@medusajs/medusa/core-flows'
import { prefixedLogger } from '../lib/log'
import { loadShipmentEmail } from '../lib/shipment-email'

const prepareShipmentEmailStep = createStep(
  'prepare-shipment-email',
  async ({ fulfillmentId }: { fulfillmentId: string }, { container }) => {
    const prepared = await loadShipmentEmail(container, fulfillmentId, process.env)
    if (!prepared) {
      prefixedLogger(container).info(
        `Wysyłka ${fulfillmentId} dotyczy zamówienia spoza sklepu albo bez e-maila – bez powiadomienia.`,
      )
    }
    return new StepResponse(prepared)
  },
)

/**
 * „Paczka w drodze” e-mail (spec 6d §5.8), the same way as the order confirmation: one
 * notification per fulfillment, so a repeated `shipment.created` after a sent e-mail is a no-op in
 * the Notification module (and the provider passes the key to Resend as `Idempotency-Key`).
 */
export const sendShipmentEmailWorkflow = createWorkflow(
  'send-shipment-email',
  (input: { fulfillmentId: string }) => {
    const prepared = prepareShipmentEmailStep(input)
    when({ prepared }, ({ prepared }) => Boolean(prepared)).then(() => {
      const notifications = transform({ prepared, input }, ({ prepared, input }) => [
        {
          to: prepared?.to as string,
          channel: 'email',
          template: 'shipment',
          data: prepared?.data as unknown as Record<string, unknown>,
          provider_data: prepared?.replyTo ? { reply_to: prepared.replyTo } : null,
          idempotency_key: `shipment:${input.fulfillmentId}`,
          // Ties the notification to its order (admin, later „resend” or retention passes).
          resource_type: 'order',
          resource_id: prepared?.orderId as string,
          trigger_type: 'shipment.created',
        },
      ])
      sendNotificationsStep(notifications)
    })
    return new WorkflowResponse(prepared)
  },
)

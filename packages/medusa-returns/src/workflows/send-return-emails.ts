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
import { logPrefix } from '../lib/plugin-options'
import { loadReturnEmails } from '../lib/return-email'

interface Input {
  orderId: string
  returnId: string
}

const prepareReturnEmailsStep = createStep(
  'prepare-return-emails',
  async ({ orderId, returnId }: Input, { container }) => {
    const prepared = await loadReturnEmails(container, orderId, returnId, process.env)
    if (!prepared.customer && !prepared.staff) {
      container
        .resolve(ContainerRegistrationKeys.LOGGER)
        .info(
          `${logPrefix(container)} Zwrot ${returnId} zamówienia ${orderId} – nie ma do kogo wysłać (zamówienie spoza sklepu, nieznany zwrot albo brak adresatów).`,
        )
    }
    return new StepResponse(prepared)
  },
)

/**
 * The e-mails about a new return (spec 6e-b §5.5): „Mamy Twoje zgłoszenie” to the customer and an
 * alert to the shop. Each is one notification keyed by the return, so `order.return_requested`
 * emitted again after a sent e-mail is a no-op in the Notification module (the provider also
 * passes the key to Resend as `Idempotency-Key`). The module sends the two independently – a
 * failing one does not stop the other.
 */
export const sendReturnEmailsWorkflow = createWorkflow('send-return-emails', (input: Input) => {
  const prepared = prepareReturnEmailsStep(input)
  const notifications = transform({ prepared, input }, ({ prepared, input }) => [
    ...(prepared.customer
      ? [
          {
            to: prepared.customer.to,
            channel: 'email',
            template: 'return-requested',
            data: prepared.customer.data as unknown as Record<string, unknown>,
            provider_data: prepared.customer.replyTo
              ? { reply_to: prepared.customer.replyTo }
              : null,
            idempotency_key: `return-requested:${input.returnId}`,
            // Ties the notification to its order (admin, later „resend” or retention passes).
            resource_type: 'order',
            resource_id: input.orderId,
            trigger_type: 'order.return_requested',
          },
        ]
      : []),
    ...(prepared.staff
      ? [
          {
            to: prepared.staff.to,
            channel: 'email',
            template: 'return-alert',
            data: prepared.staff.data as unknown as Record<string, unknown>,
            idempotency_key: `return-alert:${input.returnId}`,
            resource_type: 'order',
            resource_id: input.orderId,
            trigger_type: 'order.return_requested',
          },
        ]
      : []),
  ])
  when({ notifications }, ({ notifications }) => notifications.length > 0).then(() => {
    sendNotificationsStep(notifications)
  })
  return new WorkflowResponse(prepared)
})

import { createWorkflow, transform, WorkflowResponse } from '@medusajs/framework/workflows-sdk'
import { sendNotificationsStep } from '@medusajs/medusa/core-flows'

export interface SendEmailInput {
  /** Name of one of the provider's `templates`. */
  template: string
  to: string
  data: Record<string, unknown>
  replyTo: string | null
  /** Repeated events with the same key send nothing twice (also passed to Resend). */
  idempotencyKey: string
  /** What the e-mail is about, e.g. `customer`. */
  resourceType: string
  resourceId: string | null
  /** The event that caused the e-mail, e.g. `auth.verification_requested`. */
  trigger: string
}

/** Sends one e-mail through the notification provider on the `email` channel. */
export const sendEmailWorkflow = createWorkflow('send-email', (input: SendEmailInput) => {
  const notifications = transform({ input }, ({ input }) => [
    {
      to: input.to,
      channel: 'email',
      template: input.template,
      data: input.data,
      provider_data: input.replyTo ? { reply_to: input.replyTo } : null,
      idempotency_key: input.idempotencyKey,
      resource_type: input.resourceType,
      resource_id: input.resourceId,
      trigger_type: input.trigger,
    },
  ])
  sendNotificationsStep(notifications)
  return new WorkflowResponse(undefined)
})

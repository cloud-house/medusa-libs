const captured: unknown[] = []
jest.mock('@medusajs/medusa/core-flows', () => {
  const { createStep, StepResponse } = jest.requireActual('@medusajs/framework/workflows-sdk')
  return {
    sendNotificationsStep: createStep('send-notifications-test', async (input: unknown) => {
      captured.push(input)
      return new StepResponse([])
    }),
  }
})

import { sendEmailWorkflow } from '../workflows/send-email'

const base = {
  template: 'welcome',
  to: 'jan@example.com',
  data: { firstName: 'Jan' },
  replyTo: 'shop@example.com' as string | null,
  idempotencyKey: 'welcome:cus_1',
  resourceType: 'customer',
  resourceId: 'cus_1' as string | null,
  trigger: 'customer.created',
}

describe('sendEmailWorkflow', () => {
  beforeEach(() => {
    captured.length = 0
  })

  it('maps the input to one e-mail notification', async () => {
    await sendEmailWorkflow({ resolve: () => undefined } as never).run({ input: base })

    expect(captured).toEqual([
      [
        {
          to: 'jan@example.com',
          channel: 'email',
          template: 'welcome',
          data: { firstName: 'Jan' },
          provider_data: { reply_to: 'shop@example.com' },
          idempotency_key: 'welcome:cus_1',
          resource_type: 'customer',
          resource_id: 'cus_1',
          trigger_type: 'customer.created',
        },
      ],
    ])
  })

  it('sends provider_data null without a reply-to and keeps a null resource id', async () => {
    await sendEmailWorkflow({ resolve: () => undefined } as never).run({
      input: { ...base, replyTo: null, resourceId: null },
    })

    const [[notification]] = captured as [[Record<string, unknown>]]
    expect(notification.provider_data).toBeNull()
    expect(notification.resource_id).toBeNull()
  })
})

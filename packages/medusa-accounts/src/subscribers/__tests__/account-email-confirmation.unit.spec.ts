import { createHash } from 'node:crypto'
import accountEmailConfirmation from '../account-email-confirmation'
import { fakeContainer } from './helpers'

const run = jest.fn()
jest.mock('@cloud-house/medusa-emails/workflows/send-email', () => ({
  sendEmailWorkflow: () => ({ run }),
}))

const hash = (code: string) => createHash('sha256').update(code).digest('hex').slice(0, 24)

function setup(customer: { first_name?: string; metadata?: Record<string, unknown> } | null) {
  const listCustomers = jest.fn(async () => (customer ? [{ id: 'cus_1', ...customer }] : []))
  const listAuthIdentities = jest.fn(async () => [
    { id: 'ident_1', app_metadata: customer ? { customer_id: 'cus_1' } : {} },
  ])
  const listOrders = jest.fn(async () => [{ id: 'order_1', display_id: 1042 }])
  return {
    listCustomers,
    listOrders,
    ...fakeContainer({
      customer: { listCustomers },
      auth: { listAuthIdentities },
      order: { listOrders },
    }),
  }
}

const verification = (data: object) =>
  ({
    event: {
      name: 'auth.verification_requested',
      data: {
        entity_id: 'anna@example.com',
        entity_type: 'email',
        auth_identity_id: 'ident_1',
        code: 'abc_DEF',
        ...data,
      },
    },
  }) as never

const call = (container: unknown, data: object = {}) =>
  accountEmailConfirmation({ ...(verification(data) as object), container } as never)

describe('account-email-confirmation subscriber', () => {
  beforeEach(() => run.mockReset())

  it('sends the confirmation link with an idempotency key from the code', async () => {
    const { container } = setup({ first_name: 'Anna', metadata: {} })

    await call(container)

    const { input } = run.mock.calls[0][0]
    expect(input).toMatchObject({
      template: 'email-confirmation',
      to: 'anna@example.com',
      idempotencyKey: `email-confirmation:${hash('abc_DEF')}`,
      resourceType: 'customer',
      resourceId: 'cus_1',
      trigger: 'auth.verification_requested',
    })
    expect(input.data.actionUrl).toBe('https://shop.example/account/confirm-email?kod=abc_DEF')
    expect(input.data.orderNumber).toBeNull()
  })

  it('sends no second e-mail for the same code', async () => {
    const { container } = setup({ first_name: 'Anna', metadata: {} })

    await call(container)
    await call(container)

    const keys = run.mock.calls.map(([workflowCall]) => workflowCall.input.idempotencyKey)
    expect(keys[0]).toBe(keys[1])
  })

  it('an account from the checkout gets the set-password link with its order number', async () => {
    const { container, listOrders } = setup({
      first_name: 'Anna',
      metadata: { password_pending: true, created_from_order: 'order_1' },
    })

    await call(container)

    const { input } = run.mock.calls[0][0]
    expect(input.template).toBe('set-password')
    expect(input.idempotencyKey).toBe(`set-password:${hash('abc_DEF')}`)
    expect(input.data.actionUrl).toBe('https://shop.example/account/set-password?kod=abc_DEF')
    expect(input.data.orderNumber).toBe(1042)
    expect(listOrders).toHaveBeenCalledWith({ id: 'order_1' }, expect.anything())
  })

  it('ignores another verification entity and an already verified e-mail (no code)', async () => {
    const { container, listCustomers } = setup({ metadata: {} })

    await call(container, { entity_type: 'phone' })
    await call(container, { code: undefined })

    expect(listCustomers).not.toHaveBeenCalled()
    expect(run).not.toHaveBeenCalled()
  })

  it('logs a failing send and does not throw', async () => {
    run.mockRejectedValue(new Error('boom'))
    const { container, logger } = setup({ first_name: 'Anna', metadata: {} })

    await expect(call(container)).resolves.toBeUndefined()

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('boom'))
  })
})

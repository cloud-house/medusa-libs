import accountPasswordReset from '../account-password-reset'
import { fakeContainer, tokenWith } from './helpers'

const run = jest.fn()
jest.mock('@cloud-house/medusa-emails/workflows/send-email', () => ({
  sendEmailWorkflow: () => ({ run }),
}))

const customer = { id: 'cus_1', first_name: 'Anna' }

function setup(over: { customers?: unknown[]; notifications?: unknown[]; options?: object } = {}) {
  const listCustomers = jest.fn(async () => over.customers ?? [customer])
  const listNotifications = jest.fn(async () => over.notifications ?? [])
  return {
    listCustomers,
    listNotifications,
    ...fakeContainer(
      { customer: { listCustomers }, notification: { listNotifications } },
      over.options,
    ),
  }
}

const event = (data: object) => ({ name: 'auth.password_reset', data })

const reset = (container: never, token: string, over = {}) =>
  accountPasswordReset({
    event: event({ entity_id: ' Anna@Example.com ', actor_type: 'customer', token, ...over }),
    container,
  } as never)

describe('account-password-reset subscriber', () => {
  beforeEach(() => run.mockReset())

  it('sends the reset link to the normalised address with the jti idempotency key', async () => {
    const { container } = setup()
    const token = tokenWith('jti_1')

    await reset(container as never, token)

    expect(run).toHaveBeenCalledTimes(1)
    const { input } = run.mock.calls[0][0]
    expect(input).toMatchObject({
      template: 'password-reset',
      to: 'anna@example.com',
      replyTo: 'help@shop.example',
      idempotencyKey: 'password-reset:jti_1',
      resourceType: 'customer',
      resourceId: 'cus_1',
      trigger: 'auth.password_reset',
    })
    expect(input.data.actionUrl).toBe(
      `https://shop.example/nowe-haslo?token=${encodeURIComponent(token)}`,
    )
    expect(input.data.firstName).toBe('Anna')
  })

  it('sends no second e-mail for the same jti', async () => {
    const { container } = setup()
    const token = tokenWith('jti_1')

    await reset(container as never, token)
    await reset(container as never, token)
    await reset(container as never, tokenWith('jti_2'))

    // The repeated event reaches the workflow with the same key – the notification module and
    // Resend drop the second send by it; a new token has its own key.
    const keys = run.mock.calls.map(([call]) => call.input.idempotencyKey)
    expect(keys).toEqual(['password-reset:jti_1', 'password-reset:jti_1', 'password-reset:jti_2'])
  })

  it('ignores a reset of another actor (an admin with the same e-mail gets nothing)', async () => {
    const { container, listCustomers } = setup()
    await reset(container as never, tokenWith('j'), { actor_type: 'user' })
    expect(listCustomers).not.toHaveBeenCalled()
    expect(run).not.toHaveBeenCalled()
  })

  it('sends nothing when there is no customer account with the address', async () => {
    const { container, listCustomers } = setup({ customers: [] })
    await reset(container as never, tokenWith('j'))
    expect(listCustomers).toHaveBeenCalledWith(
      { email: 'anna@example.com', has_account: true },
      expect.anything(),
    )
    expect(run).not.toHaveBeenCalled()
  })

  it('sends nothing for a token without jti or a malformed one', async () => {
    const { container } = setup()
    await reset(container as never, tokenWith())
    await reset(container as never, 'not-a-token')
    expect(run).not.toHaveBeenCalled()
  })

  it('skips the e-mail over the throttle (options.emailThrottle) and warns', async () => {
    const recent = [{ created_at: new Date() }, { created_at: new Date() }]
    const { container, logger, listNotifications } = setup({
      notifications: recent,
      options: { emailThrottle: { max: 2, windowMs: 60_000 } },
    })

    await reset(container as never, tokenWith('j'))

    expect(listNotifications).toHaveBeenCalledWith(
      { to: 'anna@example.com', template: 'password-reset' },
      expect.objectContaining({ take: 2 }),
    )
    expect(run).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('anna@example.com'))
  })

  it('logs a failing send and does not throw', async () => {
    run.mockRejectedValue({ message: 'Resend: Invalid from' })
    const { container, logger } = setup()

    await expect(reset(container as never, tokenWith('j'))).resolves.toBeUndefined()

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Resend: Invalid from'))
  })
})

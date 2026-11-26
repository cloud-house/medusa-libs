import { resolveOptions } from '../../options'

import orderConfirmationEmail from '../order-confirmation-email'

const options = resolveOptions({ resolveContact: async () => null })
const run = jest.fn()
jest.mock('../../workflows/send-order-confirmation', () => ({
  sendOrderConfirmationWorkflow: () => ({ run }),
}))

function container(graph: jest.Mock) {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  return {
    logger,
    resolve: (key: string) =>
      ({ logger, query: { graph }, checkoutPl: { getOptions: () => options } })[key],
  }
}

const args = (c: ReturnType<typeof container>) =>
  ({ event: { name: 'order.placed', data: { id: 'order_1' } }, container: c }) as never

describe('order-confirmation-email subscriber', () => {
  beforeEach(() => run.mockReset())

  it('a failed e-mail is logged with the order number the shop shows', async () => {
    run.mockRejectedValue({ message: 'Resend: Invalid from' })
    const c = container(jest.fn().mockResolvedValue({ data: [{ display_id: 1001 }] }))

    await orderConfirmationEmail(args(c))

    expect(c.logger.error).toHaveBeenCalledWith(
      '[Checkout] E-mail z potwierdzeniem zamówienia #1001 (order_1) nie wyszedł: Resend: Invalid from',
    )
  })

  it('without the order number the log still names the order', async () => {
    run.mockRejectedValue(new Error('boom'))
    const c = container(jest.fn().mockRejectedValue(new Error('db down')))

    await orderConfirmationEmail(args(c))

    expect(c.logger.error).toHaveBeenCalledWith(
      '[Checkout] E-mail z potwierdzeniem zamówienia order_1 nie wyszedł: boom',
    )
  })

  it('a sent e-mail logs nothing', async () => {
    run.mockResolvedValue({ result: null })
    const graph = jest.fn()
    const c = container(graph)

    await orderConfirmationEmail(args(c))

    expect(c.logger.error).not.toHaveBeenCalled()
    expect(graph).not.toHaveBeenCalled()
  })
})

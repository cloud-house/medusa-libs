import { furgonetkaService } from '../../lib/__tests__/shop-options'
import shipmentEmail from '../shipment-email'

const run = jest.fn()
jest.mock('../../workflows/send-shipment-email', () => ({
  sendShipmentEmailWorkflow: () => ({ run }),
}))

function container(graph: jest.Mock) {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  return {
    logger,
    resolve: (key: string) => ({ logger, query: { graph }, furgonetka: furgonetkaService() })[key],
  }
}

const args = (c: ReturnType<typeof container>, data: Record<string, unknown> = {}) =>
  ({ event: { name: 'shipment.created', data: { id: 'ful_1', ...data } }, container: c }) as never

describe('shipment-email subscriber', () => {
  beforeEach(() => run.mockReset())

  it('sends the e-mail for the fulfillment', async () => {
    run.mockResolvedValue({ result: null })
    const c = container(jest.fn())

    await shipmentEmail(args(c))

    expect(run).toHaveBeenCalledWith({ input: { fulfillmentId: 'ful_1' } })
    expect(c.logger.error).not.toHaveBeenCalled()
  })

  it('does nothing when the shipment was created without a notification', async () => {
    const graph = jest.fn()

    await shipmentEmail(args(container(graph), { no_notification: true }))

    expect(run).not.toHaveBeenCalled()
    expect(graph).not.toHaveBeenCalled()
  })

  it('a failed e-mail is logged with the order number the shop shows and never thrown', async () => {
    run.mockRejectedValue({ message: 'Resend: Invalid from' })
    const graph = jest
      .fn()
      .mockResolvedValueOnce({ data: [{ order_id: 'order_1' }] })
      .mockResolvedValueOnce({ data: [{ display_id: 1001 }] })
    const c = container(graph)

    await expect(shipmentEmail(args(c))).resolves.toBeUndefined()

    expect(graph.mock.calls[0]?.[0]).toMatchObject({
      entity: 'order_fulfillment',
      filters: { fulfillment_id: 'ful_1' },
    })
    expect(c.logger.error).toHaveBeenCalledWith(
      '[Shop] E-mail o wysyłce zamówienia #1001 (order_1) nie wyszedł: Resend: Invalid from',
    )
  })

  it('without the order the log still names the fulfillment', async () => {
    run.mockRejectedValue(new Error('boom'))
    const c = container(jest.fn().mockRejectedValue(new Error('db down')))

    await expect(shipmentEmail(args(c))).resolves.toBeUndefined()

    expect(c.logger.error).toHaveBeenCalledWith(
      '[Shop] E-mail o wysyłce realizacji ful_1 nie wyszedł: boom',
    )
  })
})

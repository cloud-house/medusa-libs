import invoiceOnOrderPlaced from '../invoice-order-placed'
import invoiceOnPaymentCaptured from '../invoice-payment-captured'

const ensureInvoiceRow = jest.fn()
const processInvoice = jest.fn()
jest.mock('../../lib/process', () => ({
  ensureInvoiceRow: (...args: unknown[]) => ensureInvoiceRow(...args),
  processInvoice: (...args: unknown[]) => processInvoice(...args),
}))

function container(graph: jest.Mock = jest.fn()) {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  return {
    logger,
    graph,
    resolve: (key: string) =>
      ({
        logger,
        query: { graph },
        fakturownia: { getOptions: () => ({ logPrefix: '[Fakturownia]' }) },
      })[key],
  }
}

const event = (c: ReturnType<typeof container>, name: string, id: string) =>
  ({ event: { name, data: { id } }, container: c }) as never

describe('invoice subscribers', () => {
  beforeEach(() => {
    ensureInvoiceRow.mockReset().mockResolvedValue(undefined)
    processInvoice.mockReset().mockResolvedValue(null)
  })

  it('order.placed creates the row and issues the invoice', async () => {
    const c = container()

    await invoiceOnOrderPlaced(event(c, 'order.placed', 'order_1'))

    expect(ensureInvoiceRow).toHaveBeenCalledWith(c, 'order_1')
    expect(processInvoice).toHaveBeenCalledWith(c, 'order_1')
  })

  it('a failure never leaves order.placed – it is logged with the order', async () => {
    processInvoice.mockRejectedValue({ message: 'boom' })
    const c = container()

    await expect(invoiceOnOrderPlaced(event(c, 'order.placed', 'order_1'))).resolves.toBeUndefined()

    expect(c.logger.error).toHaveBeenCalledWith(
      '[Fakturownia] Faktura do zamówienia order_1 nie powstała: boom',
    )
  })

  it('payment.captured finds the order of the payment and processes its invoice', async () => {
    const graph = jest
      .fn()
      .mockResolvedValueOnce({ data: [{ payment_collection_id: 'paycol_1' }] })
      .mockResolvedValueOnce({ data: [{ order_id: 'order_1' }] })
    const c = container(graph)

    await invoiceOnPaymentCaptured(event(c, 'payment.captured', 'pay_1'))

    expect(graph.mock.calls[0]?.[0]).toMatchObject({ entity: 'payment', filters: { id: 'pay_1' } })
    expect(graph.mock.calls[1]?.[0]).toMatchObject({
      entity: 'order_payment_collection',
      filters: { payment_collection_id: 'paycol_1' },
    })
    expect(processInvoice).toHaveBeenCalledWith(c, 'order_1')
  })

  it('payment.captured also creates a row order.placed failed to create', async () => {
    const graph = jest
      .fn()
      .mockResolvedValueOnce({ data: [{ payment_collection_id: 'paycol_1' }] })
      .mockResolvedValueOnce({ data: [{ order_id: 'order_1' }] })
    const c = container(graph)

    await invoiceOnPaymentCaptured(event(c, 'payment.captured', 'pay_1'))

    expect(ensureInvoiceRow).toHaveBeenCalledWith(c, 'order_1')
    expect(ensureInvoiceRow.mock.invocationCallOrder[0]).toBeLessThan(
      processInvoice.mock.invocationCallOrder[0] ?? 0,
    )
  })

  it('payment.captured of a cart without an order yet does nothing', async () => {
    const graph = jest
      .fn()
      .mockResolvedValueOnce({ data: [{ payment_collection_id: 'paycol_1' }] })
      .mockResolvedValueOnce({ data: [] })
    const c = container(graph)

    await invoiceOnPaymentCaptured(event(c, 'payment.captured', 'pay_1'))

    expect(processInvoice).not.toHaveBeenCalled()
  })

  it('a failure never leaves payment.captured', async () => {
    const c = container(jest.fn().mockRejectedValue(new Error('db down')))

    await expect(
      invoiceOnPaymentCaptured(event(c, 'payment.captured', 'pay_1')),
    ).resolves.toBeUndefined()

    expect(c.logger.error).toHaveBeenCalledWith(
      '[Fakturownia] Faktura po płatności pay_1 nie powstała: db down',
    )
  })
})

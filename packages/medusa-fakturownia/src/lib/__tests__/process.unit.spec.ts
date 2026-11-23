import {
  ensureInvoiceRow,
  InvoiceActionError,
  processInvoice,
  recheckInvoice,
  sweepInvoices,
} from '../process'

const OPTIONS = {
  logPrefix: '[Fakturownia]',
  oidPrefix: 'INV-',
  paymentTypes: {},
  accountOrderPath: '/account/orders/:id',
  resolveContact: async () => ({
    email: 'shop@shop.example',
    phone: null,
    hours: null,
    seller: null,
  }),
  resolveOrder: async () => null,
  resolveReturnOrder: async () => null,
  resolveReturn: async () => null,
}

// Both locking providers reject so when another pass held the lock for the whole wait.
const TIMED_OUT = 'Timed-out acquiring lock.'

function container(lockError: Error) {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const services: Record<string, unknown> = {
    logger,
    locking: { execute: jest.fn().mockRejectedValue(lockError) },
    fakturownia: {
      listInvoices: jest.fn().mockResolvedValue([{ order_id: 'order_1' }]),
      getOptions: () => OPTIONS,
    },
  }
  return { logger, resolve: (key: string) => services[key] } as never as {
    logger: typeof logger
  } & Parameters<typeof processInvoice>[0]
}

describe('a pass that waited too long for the order lock', () => {
  const env = { ...process.env }
  beforeEach(() => {
    process.env.FAKTUROWNIA_URL = 'atrapa'
  })
  afterEach(() => {
    process.env = { ...env }
  })

  it('leaves the invoice to the pass that holds the lock and logs only that', async () => {
    const c = container(new Error(TIMED_OUT))

    await expect(processInvoice(c, 'order_1')).resolves.toBeNull()

    expect(c.logger.info).toHaveBeenCalledWith(
      '[Fakturownia] Faktura do zamówienia order_1 – inny przebieg już nad nią pracuje.',
    )
    expect(c.logger.warn).not.toHaveBeenCalled()
    expect(c.logger.error).not.toHaveBeenCalled()
  })

  it('in the job is not a failure either', async () => {
    const c = container(new Error(TIMED_OUT))

    await expect(sweepInvoices(c)).resolves.toEqual({ processed: 0 })

    expect(c.logger.info).toHaveBeenCalledWith(
      '[Fakturownia] Faktura do zamówienia order_1 – inny przebieg już nad nią pracuje.',
    )
    expect(c.logger.warn).not.toHaveBeenCalled()
  })

  it('asks the admin to try again in a moment', async () => {
    const busy = new InvoiceActionError(
      'Faktura do tego zamówienia jest właśnie przetwarzana – spróbuj za chwilę.',
    )

    await expect(
      processInvoice(container(new Error(TIMED_OUT)), 'order_1', { manual: true }),
    ).rejects.toEqual(busy)
    await expect(recheckInvoice(container(new Error(TIMED_OUT)), 'order_1')).rejects.toEqual(busy)
  })

  it('other lock errors still fail the pass', async () => {
    await expect(processInvoice(container(new Error('Redis down')), 'order_1')).rejects.toThrow(
      'Redis down',
    )
  })
})

describe('ensureInvoiceRow', () => {
  const env = { ...process.env }
  beforeEach(() => {
    process.env.FAKTUROWNIA_URL = 'atrapa'
  })
  afterEach(() => {
    process.env = { ...env }
  })

  const withOrder = (order: unknown) => {
    const ensureForOrder = jest.fn()
    const services: Record<string, unknown> = {
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
      fakturownia: {
        ensureForOrder,
        getOptions: () => ({ ...OPTIONS, resolveOrder: async () => order }),
      },
    }
    return { ensureForOrder, container: { resolve: (key: string) => services[key] } as never }
  }

  it('makes no row for an order that was not placed in the shop (a draft order of the admin)', async () => {
    const { ensureForOrder, container } = withOrder({ shopOrder: false, email: 'jan@example.pl' })
    await expect(ensureInvoiceRow(container, 'order_1')).resolves.toBeUndefined()
    expect(ensureForOrder).not.toHaveBeenCalled()
  })

  it('makes the row of a shop order with an e-mail', async () => {
    const { ensureForOrder, container } = withOrder({ shopOrder: true, email: 'jan@example.pl' })
    await ensureInvoiceRow(container, 'order_1')
    expect(ensureForOrder).toHaveBeenCalledWith('order_1')
  })
})

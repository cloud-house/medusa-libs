import { ensureCorrectionRow, sweepCorrections } from '../correction'

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

const CLAIM_LINE =
  '[Fakturownia] Zwrot ret_1 należy do wymiany albo reklamacji w Medusie – korekta faktury nie powstaje automatycznie.'

/** A container whose Query answers by entity; the fakturownia module only records calls. */
function container(returns: Record<string, unknown>[], shopOrder = true) {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const graph = jest.fn(async ({ entity }: { entity: string }) => ({
    data: returns,
  }))
  const fakturownia = {
    ensureCorrectionForReturn: jest.fn().mockResolvedValue({ id: 'invcor_1', status: 'waiting' }),
    listInvoiceCorrections: jest.fn().mockResolvedValue([]),
    getOptions: () => ({ ...OPTIONS, resolveOrder: async () => ({ shopOrder }) }),
  }
  const locking = { execute: jest.fn() }
  const services: Record<string, unknown> = { logger, query: { graph }, fakturownia, locking }
  return {
    logger,
    graph,
    fakturownia,
    locking,
    container: { resolve: (key: string) => services[key] } as never,
  }
}

describe('credit notes only for the returns of the shop', () => {
  const env = { ...process.env }
  beforeEach(() => {
    process.env.FAKTUROWNIA_URL = 'atrapa'
  })
  afterEach(() => {
    process.env = { ...env }
  })

  it.each([
    ['an exchange', { claim_id: null, exchange_id: 'exchange_1' }],
    ['a claim', { claim_id: 'claim_1', exchange_id: null }],
  ])('the return of %s gets no row, only an info line', async (_, ids) => {
    const c = container([ids])

    expect(await ensureCorrectionRow(c.container, 'order_1', 'ret_1')).toBeNull()

    expect(c.fakturownia.ensureCorrectionForReturn).not.toHaveBeenCalled()
    expect(c.logger.info).toHaveBeenCalledWith(CLAIM_LINE)
  })

  it('the return of an order that was not placed in the shop gets no row', async () => {
    const c = container([{ claim_id: null, exchange_id: null }], false)

    expect(await ensureCorrectionRow(c.container, 'order_1', 'ret_1')).toBeNull()

    expect(c.fakturownia.ensureCorrectionForReturn).not.toHaveBeenCalled()
  })

  it('a return of the shop gets its row', async () => {
    const c = container([{ claim_id: null, exchange_id: null }])

    expect(await ensureCorrectionRow(c.container, 'order_1', 'ret_1')).toMatchObject({
      id: 'invcor_1',
    })

    expect(c.fakturownia.ensureCorrectionForReturn).toHaveBeenCalledWith('order_1', 'ret_1')
    expect(c.graph).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'return', filters: { id: 'ret_1' } }),
    )
    expect(c.logger.info).not.toHaveBeenCalled()
  })

  it('the job looks only for received returns outside claims and exchanges', async () => {
    const c = container([])
    const now = new Date('2026-11-06T12:00:00Z')

    expect(await sweepCorrections(c.container, now)).toEqual({ processed: 0 })

    expect(c.graph).toHaveBeenCalledWith({
      entity: 'return',
      fields: ['id', 'order_id'],
      filters: {
        status: 'received',
        received_at: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60_000) },
        claim_id: null,
        exchange_id: null,
      },
    })
    expect(c.locking.execute).not.toHaveBeenCalled()
  })
})

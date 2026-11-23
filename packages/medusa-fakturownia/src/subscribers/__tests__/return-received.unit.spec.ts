import returnReceived, { config as receivedConfig } from '../return-received'

const ensureCorrectionRow = jest.fn()
const processCorrection = jest.fn()
jest.mock('../../lib/correction', () => ({
  ensureCorrectionRow: (...args: unknown[]) => ensureCorrectionRow(...args),
  processCorrection: (...args: unknown[]) => processCorrection(...args),
}))

function container() {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const services: Record<string, unknown> = {
    logger,
    fakturownia: { getOptions: () => ({ logPrefix: '[Fakturownia]' }) },
  }
  return { logger, resolve: (key: string) => services[key] }
}

const received = (c: ReturnType<typeof container>) =>
  ({
    event: { name: 'order.return_received', data: { order_id: 'order_1', return_id: 'ret_1' } },
    container: c,
  }) as never

describe('return-received subscriber', () => {
  beforeEach(() => {
    ensureCorrectionRow.mockReset().mockResolvedValue({ id: 'invcor_1' })
    processCorrection.mockReset().mockResolvedValue(null)
  })

  it('creates the correction row of the return and processes it', async () => {
    const c = container()
    expect(receivedConfig.event).toBe('order.return_received')

    await returnReceived(received(c))

    expect(ensureCorrectionRow).toHaveBeenCalledWith(c, 'order_1', 'ret_1')
    expect(processCorrection).toHaveBeenCalledWith(c, 'ret_1')
    expect(ensureCorrectionRow.mock.invocationCallOrder[0]).toBeLessThan(
      processCorrection.mock.invocationCallOrder[0] ?? 0,
    )
    expect(c.logger.error).not.toHaveBeenCalled()
  })

  it('does nothing more when there is no row to process (no Fakturownia, not a shop order)', async () => {
    ensureCorrectionRow.mockResolvedValue(null)
    const c = container()

    await returnReceived(received(c))

    expect(processCorrection).not.toHaveBeenCalled()
  })

  it('a failed correction never leaves the event – it is logged with the return and the order', async () => {
    processCorrection.mockRejectedValue({ message: 'Fakturownia leży' })
    const c = container()

    await expect(returnReceived(received(c))).resolves.toBeUndefined()

    expect(c.logger.error).toHaveBeenCalledWith(
      '[Fakturownia] Korekta faktury do zwrotu ret_1 zamówienia order_1: Fakturownia leży',
    )
  })

  it('a failure to create the row is logged too', async () => {
    ensureCorrectionRow.mockRejectedValue(new Error('db down'))
    const c = container()

    await expect(returnReceived(received(c))).resolves.toBeUndefined()

    expect(processCorrection).not.toHaveBeenCalled()
    expect(c.logger.error).toHaveBeenCalledWith(
      '[Fakturownia] Korekta faktury do zwrotu ret_1 zamówienia order_1: db down',
    )
  })
})

import accountOrderLink from '../account-order-link'

const assign = jest.fn()
const create = jest.fn()
jest.mock('../../workflows/account/assign-placed-order', () => ({
  assignPlacedOrderWorkflow: () => ({ run: assign }),
}))
jest.mock('../../workflows/account/create-account-from-checkout', () => ({
  createAccountFromCheckoutWorkflow: () => ({ run: create }),
}))

const logger = { error: jest.fn() }
const args = {
  event: { name: 'order.placed', data: { id: 'order_1' } },
  container: { resolve: () => logger },
} as never

describe('account-order-link subscriber', () => {
  beforeEach(() => {
    assign.mockReset()
    create.mockReset()
    logger.error.mockReset()
  })

  it('assigns the order first, then creates the checkout account', async () => {
    const order: string[] = []
    assign.mockImplementation(async () => void order.push('assign'))
    create.mockImplementation(async () => void order.push('create'))

    await accountOrderLink(args)

    expect(order).toEqual(['assign', 'create'])
    expect(assign).toHaveBeenCalledWith({ input: { orderId: 'order_1' } })
    expect(create).toHaveBeenCalledWith({ input: { orderId: 'order_1' } })
  })

  it('a failing assignment is logged and the checkout account is still tried', async () => {
    assign.mockRejectedValue(new Error('no'))

    await accountOrderLink(args)

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('order_1'))
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('a failing checkout account is logged and never thrown (the order stays untouched)', async () => {
    create.mockRejectedValue({ message: 'boom' })

    await expect(accountOrderLink(args)).resolves.toBeUndefined()

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('boom'))
  })
})

import { asValue } from '@medusajs/framework/awilix'
import { createMedusaContainer } from '@medusajs/framework/utils'
import { createWorkflow, WorkflowResponse } from '@medusajs/framework/workflows-sdk'
import { resolveOptions } from '../../../options'
import { eraseCustomerDataStep } from '../delete-account'

// The step alone: the deletion workflow's second step is Medusa's own `deleteCustomersWorkflow`.
const eraseWorkflow = createWorkflow(
  'test-erase-customer-data',
  (input: { customerId: string }) => new WorkflowResponse(eraseCustomerDataStep(input)),
)

function setup(
  onAccountDeleted: ((container: never, customerId: string) => Promise<void>)[],
  deletedEmail?: (customerId: string) => string,
) {
  const calls: string[] = []
  const customers = {
    listCustomerAddresses: jest.fn(async () => [{ id: 'addr_1' }]),
    deleteCustomerAddresses: jest.fn(async () => void calls.push('addresses')),
    updateCustomers: jest.fn(async () => void calls.push('customer')),
  }
  const carts = {
    listCarts: jest.fn(async () => [
      { id: 'cart_open', completed_at: null },
      { id: 'cart_done', completed_at: new Date() },
    ]),
    deleteCarts: jest.fn(async () => void calls.push('carts')),
  }
  const auth = { deleteAuthIdentities: jest.fn(async () => void calls.push('identity')) }
  const query = { graph: jest.fn(async () => ({ data: [{ id: 'ident_1' }] })) }
  const options = resolveOptions({
    paths: { confirmEmail: '/a', passwordReset: '/b', setPassword: '/c' },
    onAccountDeleted: onAccountDeleted as never,
    deletedEmail,
  })
  const services: Record<string, unknown> = {
    customer: customers,
    cart: carts,
    auth,
    query,
    accounts: { getOptions: () => options },
  }
  const container = createMedusaContainer()
  for (const [key, value] of Object.entries(services)) container.register(key, asValue(value))
  return { calls, customers, carts, auth, container }
}

describe('eraseCustomerDataStep', () => {
  it('erases the customer data, open carts and the identity, calling onAccountDeleted in order', async () => {
    const order: string[] = []
    const { calls, customers, carts, auth, container } = setup([
      async (_c, id) => void order.push(`first:${id}`),
      async (_c, id) => void order.push(`second:${id}`),
    ])

    const { result } = await eraseWorkflow(container as never).run({
      input: { customerId: 'cus_1' },
    })

    expect(result).toBe('cus_1')
    expect(order).toEqual(['first:cus_1', 'second:cus_1'])
    expect(customers.deleteCustomerAddresses).toHaveBeenCalledWith(['addr_1'])
    expect(customers.updateCustomers).toHaveBeenCalledWith(
      'cus_1',
      expect.objectContaining({
        first_name: null,
        last_name: null,
        phone: null,
        company_name: null,
      }),
    )
    expect(carts.deleteCarts).toHaveBeenCalledWith(['cart_open'])
    expect(auth.deleteAuthIdentities).toHaveBeenCalledWith(['ident_1'])
    expect(calls).toEqual(['addresses', 'customer', 'carts', 'identity'])
  })

  it('aborts the account deletion when an onAccountDeleted callback throws', async () => {
    const after = jest.fn()
    const { customers, auth, container } = setup([
      async () => {
        throw new Error('favourites are down')
      },
      after,
    ])

    // `run` rejects with the callback's error, so the route answers with it.
    const rejection = await eraseWorkflow(container as never)
      .run({ input: { customerId: 'cus_1' } })
      .then(
        () => null,
        (error: unknown) => error as { message?: string },
      )
    expect(rejection?.message).toBe('favourites are down')

    // The customer's own data is already erased and is not restored (a half-deleted account is
    // better than restored data); the later callback and the identity removal did not run.
    expect(customers.updateCustomers).toHaveBeenCalledTimes(1)
    expect(customers.updateCustomers).toHaveBeenCalledWith(
      'cus_1',
      expect.objectContaining({ first_name: null }),
    )
    expect(after).not.toHaveBeenCalled()
    expect(auth.deleteAuthIdentities).not.toHaveBeenCalled()
  })

  it('writes the default placeholder e-mail over the erased account', async () => {
    const { customers, container } = setup([])
    await eraseWorkflow(container as never).run({ input: { customerId: 'cus_1' } })
    expect(customers.updateCustomers).toHaveBeenCalledWith(
      'cus_1',
      expect.objectContaining({ email: 'deleted+cus_1@account-deleted.invalid' }),
    )
  })

  it("writes the shop's own placeholder e-mail when deletedEmail is set", async () => {
    const { customers, container } = setup([], (id) => `usuniete+${id}@example.invalid`)
    await eraseWorkflow(container as never).run({ input: { customerId: 'cus_1' } })
    expect(customers.updateCustomers).toHaveBeenCalledWith(
      'cus_1',
      expect.objectContaining({ email: 'usuniete+cus_1@example.invalid' }),
    )
  })

  it('works without callbacks', async () => {
    const { auth, container } = setup([])
    await eraseWorkflow(container as never).run({ input: { customerId: 'cus_1' } })
    expect(auth.deleteAuthIdentities).toHaveBeenCalledTimes(1)
  })
})

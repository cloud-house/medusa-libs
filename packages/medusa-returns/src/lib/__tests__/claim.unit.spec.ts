import { RETURN_MESSAGES, RETURN_OPTION_CODE } from '@cloud-house/commerce-rules'
import { Modules } from '@medusajs/framework/utils'
import { RETURNS_ERROR_CODES } from '../../errors'
import { claimReturn, ReturnClaimError } from '../claim'

/** A container whose only service is a lock that fails with the given error. */
function lockedWith(error: unknown) {
  return {
    resolve: (key: string) => {
      if (key !== Modules.LOCKING) throw new Error(`unexpected service ${key}`)
      return {
        execute: async (name: string) => {
          expect(name).toBe('return-claim:order_1')
          throw error
        },
      }
    },
  } as never
}

const INPUT = { orderId: 'order_1', items: [], note: null }

describe('claimReturn – the lock of the order', () => {
  it('a wait that ran out is the "busy" answer, 409', async () => {
    const claim = claimReturn(lockedWith(new Error('Timed-out acquiring lock.')), INPUT)

    await expect(claim).rejects.toMatchObject({ status: 409, message: RETURN_MESSAGES.busy })
    await expect(claim).rejects.toBeInstanceOf(ReturnClaimError)
  })

  it('any other lock error is not hidden as "busy"', async () => {
    const claim = claimReturn(lockedWith(new Error('redis is down')), INPUT)

    await expect(claim).rejects.toThrow('redis is down')
    await expect(claim).rejects.not.toBeInstanceOf(ReturnClaimError)
  })
})

describe('ReturnClaimError', () => {
  it('400 by default; the body type follows the status', () => {
    expect(new ReturnClaimError('x')).toMatchObject({ status: 400, type: 'not_allowed' })
    expect(new ReturnClaimError('x', 404)).toMatchObject({ status: 404, type: 'not_found' })
    expect(new ReturnClaimError('x', 409)).toMatchObject({ status: 409, type: 'conflict' })
  })
})

/** A container with a lock that runs the callback and a shop that gives `order`. */
function shop(order: unknown, services: Record<string, unknown> = {}) {
  return {
    resolve: (key: string) => {
      if (key === Modules.LOCKING) return { execute: async (_: string, fn: () => unknown) => fn() }
      if (key === 'shopReturns') {
        return {
          getOptions: () => ({
            resolveOrder: async () => order,
            resolveContact: async () => null,
            logPrefix: '[Shop]',
          }),
        }
      }
      if (key in services) return services[key]
      return { warn: () => undefined, error: () => undefined }
    },
  } as never
}

const SHIPPED_ORDER = {
  id: 'order_1',
  displayId: 7,
  email: 'a@b.pl',
  shopOrder: true,
  canceled: false,
  items: [
    {
      id: 'item_1',
      title: 'Deska',
      variant: null,
      thumbnail: null,
      quantities: { quantity: 1, shipped: 1, requested: 0, received: 0, dismissed: 0 },
    },
  ],
  fulfillments: [{ shippedAt: new Date(), deliveredAt: new Date(), canceledAt: null }],
  returns: [],
}

describe('claimReturn – the order', () => {
  it('an order not placed in the shop is 404 and nothing is created', async () => {
    const claim = claimReturn(shop({ ...SHIPPED_ORDER, shopOrder: false }), {
      orderId: 'order_1',
      items: [{ id: 'item_1', quantity: 1, reason: 'size' }],
      note: null,
    })

    await expect(claim).rejects.toMatchObject({
      status: 404,
      message: 'Nie znaleziono zamówienia.',
    })
  })

  it('an unknown order is 404', async () => {
    await expect(claimReturn(shop(null), { ...INPUT })).rejects.toMatchObject({ status: 404 })
  })

  it('a missing return shipping option is a clear configuration error, not a return', async () => {
    const fulfillment = { listShippingOptions: async () => [] }
    const order = { listReturnReasons: async () => [] }
    const services = { [Modules.FULFILLMENT]: fulfillment, [Modules.ORDER]: order }
    const claim = claimReturn(shop(SHIPPED_ORDER, services), {
      orderId: 'order_1',
      items: [{ id: 'item_1', quantity: 1, reason: 'size' }],
      note: null,
    })

    await expect(claim).rejects.toThrow(RETURNS_ERROR_CODES.noReturnOption)
    await expect(claim).rejects.toThrow(RETURN_OPTION_CODE)
  })

  it('a reason missing in the database is a clear configuration error', async () => {
    const fulfillment = {
      listShippingOptions: async () => [{ id: 'so_1', type: { code: RETURN_OPTION_CODE } }],
    }
    const order = { listReturnReasons: async () => [] }
    const query = {
      graph: async () => ({
        data: [{ service_zone: { fulfillment_set: { location: { id: 'loc_1' } } } }],
      }),
    }
    const claim = claimReturn(
      shop(SHIPPED_ORDER, {
        [Modules.FULFILLMENT]: fulfillment,
        [Modules.ORDER]: order,
        query,
      }),
      { orderId: 'order_1', items: [{ id: 'item_1', quantity: 1, reason: 'size' }], note: null },
    )

    await expect(claim).rejects.toThrow(RETURNS_ERROR_CODES.noReturnReason)
  })
})

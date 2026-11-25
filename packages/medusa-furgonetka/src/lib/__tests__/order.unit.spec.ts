import { loadShippingOrder, pendingOrderIds } from '../order'

type Row = Record<string, unknown>

/** A container whose `query.graph` answers by entity and remembers what it was asked. */
function stub({ orders, carts }: { orders: Row[]; carts: string[] }) {
  const graph = jest.fn(async ({ entity, filters }: { entity: string; filters: Row }) => {
    if (entity === 'order') return { data: orders }
    // The cart links of the candidates only.
    const asked = filters.order_id as string[]
    return { data: carts.filter((id) => asked.includes(id)).map((order_id) => ({ order_id })) }
  })
  const container = { resolve: () => ({ graph }) } as never
  return { container, graph }
}

const order = (id: string, over: Row = {}): Row => ({
  id,
  created_at: '2026-11-01T10:00:00.000Z',
  canceled_at: null,
  fulfillments: [],
  ...over,
})

describe('pendingOrderIds', () => {
  it('keeps the pending orders without a fulfillment, in the order the query gave them', async () => {
    const { container } = stub({
      orders: [order('order_1'), order('order_2'), order('order_3')],
      carts: ['order_1', 'order_2', 'order_3'],
    })

    expect(await pendingOrderIds(container)).toEqual(['order_1', 'order_2', 'order_3'])
  })

  it('drops an order that has a fulfillment, however old', async () => {
    const { container } = stub({
      orders: [
        order('order_1', { fulfillments: [{ id: 'ful_1', canceled_at: null }] }),
        order('order_2'),
      ],
      carts: ['order_1', 'order_2'],
    })

    expect(await pendingOrderIds(container)).toEqual(['order_2'])
  })

  it('takes an order back whose fulfillments were all canceled', async () => {
    const { container } = stub({
      orders: [
        order('order_1', {
          fulfillments: [
            { id: 'ful_1', canceled_at: '2026-11-02T10:00:00.000Z' },
            { id: 'ful_2', canceled_at: '2026-11-02T11:00:00.000Z' },
          ],
        }),
        order('order_2', {
          fulfillments: [
            { id: 'ful_3', canceled_at: '2026-11-02T10:00:00.000Z' },
            { id: 'ful_4', canceled_at: null },
          ],
        }),
      ],
      carts: ['order_1', 'order_2'],
    })

    expect(await pendingOrderIds(container)).toEqual(['order_1'])
  })

  it('drops a canceled order and ignores empty fulfillment links', async () => {
    const { container } = stub({
      orders: [
        order('order_1', { canceled_at: '2026-11-02T10:00:00.000Z' }),
        order('order_2', { fulfillments: [null] }),
      ],
      carts: ['order_1', 'order_2'],
    })

    expect(await pendingOrderIds(container)).toEqual(['order_2'])
  })

  it('drops an order that was not placed in the shop (no cart)', async () => {
    const { container } = stub({
      orders: [order('order_1'), order('order_2')],
      carts: ['order_2'],
    })

    expect(await pendingOrderIds(container)).toEqual(['order_2'])
  })

  it('reads the pending orders in one query, oldest first, and their cart links in another', async () => {
    const { container, graph } = stub({ orders: [order('order_1')], carts: ['order_1'] })

    await pendingOrderIds(container)

    expect(graph).toHaveBeenCalledTimes(2)
    expect(graph).toHaveBeenNthCalledWith(1, {
      entity: 'order',
      fields: ['id', 'created_at', 'canceled_at', 'fulfillments.id', 'fulfillments.canceled_at'],
      filters: { status: 'pending' },
      pagination: { order: { created_at: 'ASC' } },
    })
    expect(graph).toHaveBeenNthCalledWith(2, {
      entity: 'order_cart',
      fields: ['order_id'],
      filters: { order_id: ['order_1'] },
    })
  })

  it('does not ask for cart links when nothing is a candidate', async () => {
    const { container, graph } = stub({
      orders: [order('order_1', { fulfillments: [{ id: 'ful_1', canceled_at: null }] })],
      carts: ['order_1'],
    })

    expect(await pendingOrderIds(container)).toEqual([])
    expect(graph).toHaveBeenCalledTimes(1)
  })
})

describe('loadShippingOrder', () => {
  const source = {
    id: 'order_1',
    items: [
      { id: 'i1', title: 'Deska', variant: null, quantity: 1, productId: 'prod_1' },
      { id: 'i2', title: 'Pompka', variant: null, quantity: 1, productId: 'prod_2' },
      { id: 'i3', title: 'Własny', variant: null, quantity: 1, productId: null },
    ],
  }

  function shop(answer: Map<string, string>, order: unknown = source) {
    const resolveParcelClasses = jest.fn(async () => answer)
    const options = {
      resolveOrder: async () => order,
      resolveParcelClasses,
      parcelClasses: [{ key: 'board', label: 'Deska', carriers: ['dpd'] }],
      logPrefix: '[Shop]',
    }
    const container = {
      resolve: (key: string) =>
        key === 'furgonetka' ? { getOptions: () => options } : { warn: () => undefined },
    } as never
    return { container, resolveParcelClasses }
  }

  it('adds the parcel class of every item, one question for all products', async () => {
    const { container, resolveParcelClasses } = shop(new Map([['prod_1', 'board']]))

    const order = await loadShippingOrder(container, 'order_1')

    expect(order?.items.map((item) => item.parcelClass)).toEqual(['board', null, null])
    expect(resolveParcelClasses).toHaveBeenCalledTimes(1)
    expect(resolveParcelClasses).toHaveBeenCalledWith(container, ['prod_1', 'prod_2'])
  })

  it('answers null for an unknown order', async () => {
    const { container } = shop(new Map(), null)

    expect(await loadShippingOrder(container, 'nope')).toBeNull()
  })
})

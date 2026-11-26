import { resolveOptions } from '../../options'
import { orderNeedsCourier, reviewOrderDelivery } from '../delivery-review'
import { quantitiesByVariant } from '../stock'

const mockClasses = jest.fn()
jest.mock('@cloud-house/medusa-furgonetka', () => ({
  FURGONETKA_MODULE: 'furgonetka',
  parcelClassesOf: (...args: unknown[]) => mockClasses(...args),
}))

const options = resolveOptions({ resolveContact: async () => null })

function fake(code: string, updates: unknown[] = []) {
  const order = {
    id: 'order_1',
    metadata: { a: 1 },
    items: [{ product_id: 'prod_a', product_title: 'A', title: 'A' }],
    shipping_methods: [{ shipping_option_id: 'so_1' }],
  }
  const graph = async ({ entity }: { entity: string }) =>
    entity === 'order' ? { data: [order] } : { data: [{ id: 'so_1', type: { code } }] }
  return {
    resolve: (key: string) => {
      if (key === 'query') return { graph }
      if (key === 'checkoutPl') return { getOptions: () => options }
      if (key === 'furgonetka') return {}
      if (key === 'order') return { updateOrders: async (rows: unknown[]) => updates.push(...rows) }
      throw new Error(`no ${key}`)
    },
  } as never
}

describe('orderNeedsCourier', () => {
  beforeEach(() => {
    mockClasses.mockReset()
    mockClasses.mockResolvedValue(new Map([['prod_a', 'board']]))
  })

  it('a bulky item in a parcel locker order needs a review', async () => {
    expect((await orderNeedsCourier(fake('paczkomat-inpost'), 'order_1')).review).toBe(
      'board_to_parcel_locker',
    )
  })

  it('a bulky item with the InPost courier needs a different review', async () => {
    expect((await orderNeedsCourier(fake('kurier-inpost'), 'order_1')).review).toBe(
      'bulky_with_inpost_courier',
    )
  })

  it('the courier of the shop, or nothing bulky, needs none', async () => {
    expect((await orderNeedsCourier(fake('kurier-dpd'), 'order_1')).review).toBeNull()
    mockClasses.mockResolvedValue(new Map())
    expect((await orderNeedsCourier(fake('paczkomat-inpost'), 'order_1')).review).toBeNull()
  })

  it('reviewOrderDelivery flags the order and keeps its metadata', async () => {
    const updates: unknown[] = []
    expect(await reviewOrderDelivery(fake('paczkomat-inpost', updates), 'order_1')).toBe(true)
    expect(updates).toEqual([
      { id: 'order_1', metadata: { a: 1, delivery_review: 'board_to_parcel_locker' } },
    ])
  })
})

describe('quantitiesByVariant', () => {
  it('sums per variant, skipping lines without a variant', () => {
    expect(
      quantitiesByVariant([
        { variant_id: 'v1', quantity: 1 },
        { variant_id: 'v1', quantity: '2' },
        { variant_id: null, quantity: 5 },
        null,
      ]),
    ).toEqual(new Map([['v1', 3]]))
  })
})

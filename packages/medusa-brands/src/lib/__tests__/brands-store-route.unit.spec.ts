import type { MedusaStoreRequest } from '@medusajs/framework/http'
import { GET } from '../../api/store/brands/route'
import { resolveOptions } from '../../options'
import { brandsStoreRoute } from '../brands-store-route'

const brand = (
  name: string,
  products: { status: string; channels: string[] }[],
): Record<string, unknown> => ({
  id: `brand_${name}`,
  name,
  handle: name.toLowerCase(),
  products: products.map((product, index) => ({
    id: `prod_${name}_${index}`,
    status: product.status,
    sales_channels: product.channels.map((id) => ({ id })),
  })),
})

const request = (options: Parameters<typeof resolveOptions>[0], channels: string[]) =>
  ({
    publishable_key_context: { sales_channel_ids: channels },
    scope: {
      resolve: (key: string) =>
        key === 'query'
          ? {
              graph: async () => ({
                data: [
                  brand('Zeta', [{ status: 'published', channels: ['sc_1'] }]),
                  brand('Alfa', [
                    { status: 'published', channels: ['sc_1', 'sc_2'] },
                    { status: 'draft', channels: ['sc_1'] },
                    { status: 'published', channels: ['sc_2'] },
                  ]),
                  brand('Łoś', []),
                ],
              }),
            }
          : { getOptions: () => resolveOptions(options) },
    },
  }) as unknown as MedusaStoreRequest

const response = () => {
  const res = { json: jest.fn() }
  return res as typeof res & Parameters<typeof brandsStoreRoute>[1]
}

describe('GET /store/brands', () => {
  it('counts only published products in the key’s sales channels, sorted by name', async () => {
    const res = response()
    await brandsStoreRoute(request({}, ['sc_1']), res)
    expect(res.json).toHaveBeenCalledWith({
      brands: [
        { id: 'brand_Alfa', handle: 'alfa', name: 'Alfa', product_count: 1 },
        { id: 'brand_Łoś', handle: 'łoś', name: 'Łoś', product_count: 0 },
        { id: 'brand_Zeta', handle: 'zeta', name: 'Zeta', product_count: 1 },
      ],
    })
  })

  it('counts nothing when the key has no sales channel', async () => {
    const res = response()
    await brandsStoreRoute(request({}, []), res)
    const { brands } = res.json.mock.calls[0][0]
    expect(brands.map((b: { product_count: number }) => b.product_count)).toEqual([0, 0, 0])
  })

  it('the route answers with the handler by default', async () => {
    const res = response()
    const next = jest.fn()
    await GET(request({}, ['sc_1']), res, next)
    expect(res.json).toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
  })

  it('storeRoute: false hands the request on (404) instead of answering', async () => {
    const res = response()
    const next = jest.fn()
    await GET(request({ storeRoute: false }, ['sc_1']), res, next)
    expect(next).toHaveBeenCalledWith()
    expect(res.json).not.toHaveBeenCalled()
  })
})

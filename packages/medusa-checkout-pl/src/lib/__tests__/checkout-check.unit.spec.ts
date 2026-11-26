import { MOBILE_FOR_LOCKER } from '@cloud-house/commerce-rules'
import { resolveOptions } from '../../options'
import { runCheckoutCheck } from '../checkout-check'

const mockClasses = jest.fn()
jest.mock('@cloud-house/medusa-furgonetka', () => ({
  FURGONETKA_MODULE: 'furgonetka',
  parcelClassesOf: (...args: unknown[]) => mockClasses(...args),
  normalizeLockerCode: (value: unknown) =>
    typeof value === 'string' && /^[A-Z]{3}\d{2,3}[A-Z]?$/.test(value) ? value : null,
}))

const options = resolveOptions({ resolveContact: async () => null })

/** A container with a cart, shipping option codes and the furgonetka module registered. */
function fake(cart: Record<string, unknown> | null, codes: Record<string, string> = {}) {
  const graph = async ({
    entity,
    filters,
  }: {
    entity: string
    filters: { id: string | string[] }
  }) => {
    if (entity === 'cart') return { data: cart ? [cart] : [] }
    if (entity === 'shipping_option') {
      const ids = ([] as string[]).concat(filters.id)
      return { data: ids.map((id) => ({ id, type: { code: codes[id] ?? '' } })) }
    }
    return { data: [] }
  }
  return {
    resolve: (key: string) => {
      if (key === 'query') return { graph }
      if (key === 'checkoutPl') return { getOptions: () => options }
      if (key === 'furgonetka') return {}
      throw new Error(`no ${key}`)
    },
  } as never
}

const line = { variant_id: null, quantity: 1, product_id: 'prod_a', product_title: 'A', title: 'A' }
const cartWith = (
  methodOption: string | null,
  data: Record<string, unknown> = {},
  phone = '+48600100200',
) => ({
  id: 'cart_1',
  sales_channel_id: null,
  shipping_address: { phone },
  items: [line],
  shipping_methods: methodOption ? [{ shipping_option_id: methodOption, data }] : [],
})

describe('runCheckoutCheck', () => {
  beforeEach(() => {
    mockClasses.mockReset()
    mockClasses.mockResolvedValue(new Map())
  })

  it('throws NOT_FOUND for an unknown cart', async () => {
    await expect(runCheckoutCheck(fake(null), 'cart_x', undefined)).rejects.toThrow(
      'Nie znaleziono koszyka.',
    )
  })

  it('asks for a delivery method', async () => {
    expect(await runCheckoutCheck(fake(cartWith(null)), 'cart_1', undefined)).toEqual({
      field: 'delivery',
      message: 'Wybierz sposób dostawy.',
    })
  })

  it('a courier is ok', async () => {
    expect(
      await runCheckoutCheck(
        fake(cartWith('so_dpd'), { so_dpd: 'kurier-dpd' }),
        'cart_1',
        undefined,
      ),
    ).toBeNull()
  })

  it('a parcel locker needs a point', async () => {
    const problem = await runCheckoutCheck(
      fake(cartWith('so_l'), { so_l: 'paczkomat-inpost' }),
      'cart_1',
      undefined,
    )
    expect(problem).toEqual({ field: 'delivery', message: 'Wybierz paczkomat.' })
  })

  it('a parcel locker needs a mobile number', async () => {
    const cart = cartWith('so_l', { parcel_locker: 'KRA01M' }, '+48221234567')
    const problem = await runCheckoutCheck(
      fake(cart, { so_l: 'paczkomat-inpost' }),
      'cart_1',
      undefined,
    )
    expect(problem).toEqual({ field: 'delivery', message: MOBILE_FOR_LOCKER })
    expect(
      await runCheckoutCheck(
        fake(cartWith('so_l', { parcel_locker: 'KRA01M' }), { so_l: 'paczkomat-inpost' }),
        'cart_1',
        undefined,
      ),
    ).toBeNull()
  })

  it('a bulky item closes the parcel locker and the InPost courier with the reason', async () => {
    mockClasses.mockResolvedValue(new Map([['prod_a', 'board']]))
    expect(
      await runCheckoutCheck(
        fake(cartWith('so_l', { parcel_locker: 'KRA01M' }), { so_l: 'paczkomat-inpost' }),
        'cart_1',
        undefined,
      ),
    ).toEqual({
      field: 'delivery',
      message:
        'Paczkomat jest niedostępny dla tych produktów – wybierz kuriera. A nie mieści się w paczkomacie.',
    })
    expect(
      await runCheckoutCheck(
        fake(cartWith('so_i'), { so_i: 'kurier-inpost' }),
        'cart_1',
        undefined,
      ),
    ).toEqual({
      field: 'delivery',
      message:
        'Kurier InPost jest niedostępny dla tych produktów – wybierz Kuriera DPD. A wysyłamy tylko kurierem DPD.',
    })
  })
})

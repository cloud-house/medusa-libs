import { RETURNS_ERROR_CODES } from '../errors'
import ShopReturnsModuleService from '../modules/shop-returns/service'
import { resolveOptions } from '../options'

const resolveOrder = async () => null
const resolveContact = async () => null

describe('resolveOptions', () => {
  it('throws returns_missing_option naming the first missing function', () => {
    expect(() => resolveOptions({} as never)).toThrow(RETURNS_ERROR_CODES.missingOption)
    expect(() => resolveOptions({} as never)).toThrow('"resolveOrder"')
    expect(() => resolveOptions({ resolveOrder } as never)).toThrow('"resolveContact"')
  })

  it('fills the defaults', () => {
    expect(resolveOptions({ resolveOrder, resolveContact })).toEqual({
      resolveOrder,
      resolveContact,
      logPrefix: '[Returns]',
      labelPath: '/returns/label?order=:displayId',
      accountOrderPath: '/account/orders/:id',
      emailCopy: { shippingHint: null, packingHint: null, afterReceiveHint: null },
    })
  })

  it('keeps the shop e-mail copy and treats undefined parts as unset', () => {
    const options = resolveOptions({
      resolveOrder,
      resolveContact,
      emailCopy: { shippingHint: 'Ship by courier.', packingHint: undefined },
    })
    expect(options.emailCopy).toEqual({
      shippingHint: 'Ship by courier.',
      packingHint: null,
      afterReceiveHint: null,
    })
  })

  it('treats undefined optional values as unset', () => {
    const options = resolveOptions({ resolveOrder, resolveContact, logPrefix: undefined })
    expect(options.logPrefix).toBe('[Returns]')
  })

  it('keeps the shop values', () => {
    const options = resolveOptions({
      resolveOrder,
      resolveContact,
      logPrefix: '[Shop]',
      labelPath: '/zwrot/etykieta?zamowienie=:displayId',
      accountOrderPath: '/konto/zamowienia/:id',
    })
    expect(options).toMatchObject({
      logPrefix: '[Shop]',
      labelPath: '/zwrot/etykieta?zamowienie=:displayId',
      accountOrderPath: '/konto/zamowienia/:id',
    })
  })

  it('rejects an accountOrderPath without :id and a labelPath without :displayId', () => {
    expect(() =>
      resolveOptions({ resolveOrder, resolveContact, accountOrderPath: '/konto' }),
    ).toThrow(RETURNS_ERROR_CODES.invalidOption)
    expect(() => resolveOptions({ resolveOrder, resolveContact, labelPath: '/zwrot' })).toThrow(
      RETURNS_ERROR_CODES.invalidOption,
    )
  })
})

describe('ShopReturnsModuleService', () => {
  it('hands the resolved options to subscribers and routes', () => {
    const service = new ShopReturnsModuleService({}, { resolveOrder, resolveContact })
    expect(service.getOptions().logPrefix).toBe('[Returns]')
  })

  it('fails at construction when a required option is missing', () => {
    expect(() => new ShopReturnsModuleService({}, undefined as never)).toThrow(
      RETURNS_ERROR_CODES.missingOption,
    )
  })
})

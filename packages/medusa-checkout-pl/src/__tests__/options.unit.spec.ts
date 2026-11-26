import { CHECKOUT_PL_ERROR_CODES } from '../errors'
import CheckoutPlModuleService from '../modules/checkout-pl/service'
import { resolveOptions } from '../options'

const resolveContact = async () => null

describe('resolveOptions', () => {
  it('throws checkout_pl_missing_option when resolveContact is missing or not a function', () => {
    expect(() => resolveOptions({} as never)).toThrow(CHECKOUT_PL_ERROR_CODES.missingOption)
    expect(() => resolveOptions({} as never)).toThrow('"resolveContact"')
    expect(() => resolveOptions({ resolveContact: 'x' } as never)).toThrow('"resolveContact"')
  })

  it('fills the defaults', () => {
    const options = resolveOptions({ resolveContact })
    expect(options.deliveryCodes).toEqual({
      inpostCourier: 'kurier-inpost',
      inpostLocker: 'paczkomat-inpost',
      courier: 'kurier-dpd',
    })
    expect(options.deliveryOrder).toEqual(['kurier-inpost', 'kurier-dpd', 'paczkomat-inpost'])
    expect(options.currency).toBe('pln')
    expect(options.storefrontUrlEnv).toBe('STOREFRONT_URL')
    expect(options.replyToEnv).toBe('EMAIL_REPLY_TO')
    expect(options.logPrefix).toBe('[Checkout]')
    expect(options.texts).toEqual({
      lockerBlocked: 'Paczkomat jest niedostępny dla tych produktów – wybierz kuriera.',
      lockerMissing: 'Wybierz paczkomat.',
      courierBlocked: 'Kurier InPost jest niedostępny dla tych produktów – wybierz Kuriera DPD.',
    })
    expect(options.variantLabels).toBeNull()
    expect(options.blockReasons.locker).toBeNull()
  })

  it('the default order follows custom codes', () => {
    const options = resolveOptions({
      resolveContact,
      deliveryCodes: { courier: 'dpd', inpostLocker: 'locker' },
    })
    expect(options.deliveryOrder).toEqual(['kurier-inpost', 'dpd', 'locker'])
  })

  it('undefined values do not wipe a default', () => {
    const options = resolveOptions({ resolveContact, currency: undefined, logPrefix: undefined })
    expect(options.currency).toBe('pln')
    expect(options.logPrefix).toBe('[Checkout]')
  })

  it('throws checkout_pl_invalid_option for empty codes, an empty currency or a bad order', () => {
    const invalid = CHECKOUT_PL_ERROR_CODES.invalidOption
    expect(() => resolveOptions({ resolveContact, deliveryCodes: { courier: ' ' } })).toThrow(
      invalid,
    )
    expect(() => resolveOptions({ resolveContact, currency: '' })).toThrow('"currency"')
    expect(() => resolveOptions({ resolveContact, deliveryOrder: 'x' as never })).toThrow(
      '"deliveryOrder"',
    )
  })

  it('does not share the deliveryOrder array with the caller', () => {
    const order = ['a', 'b']
    const options = resolveOptions({ resolveContact, deliveryOrder: order })
    order.push('c')
    expect(options.deliveryOrder).toEqual(['a', 'b'])
  })
})

describe('CheckoutPlModuleService', () => {
  it('validates at construction and returns the resolved options', () => {
    expect(() => new CheckoutPlModuleService({}, {} as never)).toThrow('"resolveContact"')
    const service = new CheckoutPlModuleService({}, { resolveContact })
    expect(service.getOptions().resolveContact).toBe(resolveContact)
  })
})

describe('resolveOptions: stricter validation (review)', () => {
  const invalid = CHECKOUT_PL_ERROR_CODES.invalidOption
  const base = { resolveContact }

  it('empty customer texts are refused (an empty lockerMissing would let a locker order without a point through)', () => {
    expect(() => resolveOptions({ ...base, texts: { lockerMissing: '' } })).toThrow(
      '"texts.lockerMissing"',
    )
    expect(() => resolveOptions({ ...base, texts: { courierBlocked: ' ' } })).toThrow(invalid)
  })

  it('options that must be functions are checked at start-up', () => {
    expect(() => resolveOptions({ ...base, variantLabels: 'x' as never })).toThrow(
      '"variantLabels"',
    )
    expect(() => resolveOptions({ ...base, groupLines: {} as never })).toThrow('"groupLines"')
    expect(() => resolveOptions({ ...base, blockReasons: { locker: 'text' as never } })).toThrow(
      '"blockReasons.locker"',
    )
  })

  it('log prefix and env names must be non-empty texts', () => {
    expect(() => resolveOptions({ ...base, logPrefix: '' })).toThrow('"logPrefix"')
    expect(() => resolveOptions({ ...base, storefrontUrlEnv: '' })).toThrow('"storefrontUrlEnv"')
    expect(() => resolveOptions({ ...base, replyToEnv: 5 as never })).toThrow('"replyToEnv"')
  })

  it('asyncPaymentMethodTypes is an argument of paymentModules only', () => {
    expect(resolveOptions(base)).not.toHaveProperty('asyncPaymentMethodTypes')
  })
})

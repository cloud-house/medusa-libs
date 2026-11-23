import { type FakturowniaOptions, resolveOptions } from '../options'

const fn = async () => null
const base = (overrides: Partial<FakturowniaOptions> = {}): FakturowniaOptions => ({
  resolveOrder: fn,
  resolveReturnOrder: fn,
  resolveReturn: fn,
  ...overrides,
})

describe('resolveOptions', () => {
  it('fills in the defaults', () => {
    const resolved = resolveOptions(base())
    expect(resolved.paymentTypes).toEqual({})
    expect(resolved.oidPrefix).toBe('INV-')
    expect(resolved.logPrefix).toBe('[Fakturownia]')
    expect(resolved.accountOrderPath).toBe('/account/orders/:id')
    expect(resolved.resolveContact).toBeNull()
  })

  it('keeps what the shop passes', () => {
    const resolveContact = async () => null
    const resolved = resolveOptions(
      base({
        resolveContact,
        paymentTypes: { pp_card: 'card' },
        oidPrefix: 'CHNS-',
        logPrefix: '[ChoNaSupa]',
        accountOrderPath: '/konto/zamowienia/:id',
      }),
    )
    expect(resolved).toMatchObject({
      resolveContact,
      paymentTypes: { pp_card: 'card' },
      oidPrefix: 'CHNS-',
      logPrefix: '[ChoNaSupa]',
      accountOrderPath: '/konto/zamowienia/:id',
    })
  })

  it.each(['resolveOrder', 'resolveReturnOrder', 'resolveReturn'] as const)(
    'throws fakturownia_missing_option without %s',
    (key) => {
      expect(() => resolveOptions(base({ [key]: undefined }))).toThrow(
        new RegExp(`fakturownia_missing_option.*"${key}"`),
      )
    },
  )

  it('refuses an account order path without :id', () => {
    expect(() => resolveOptions(base({ accountOrderPath: '/account/orders' }))).toThrow(/:id/)
  })

  it('treats undefined optional values as unset', () => {
    const resolved = resolveOptions(
      base({ oidPrefix: undefined, logPrefix: undefined, paymentTypes: undefined }),
    )
    expect(resolved).toMatchObject({
      oidPrefix: 'INV-',
      logPrefix: '[Fakturownia]',
      paymentTypes: {},
    })
  })
})

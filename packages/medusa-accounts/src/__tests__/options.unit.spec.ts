import { messages } from '../messages'
import { type AccountsOptions, resolveOptions } from '../options'

const paths = {
  confirmEmail: '/konto/potwierdz-email',
  passwordReset: '/konto/nowe-haslo',
  setPassword: '/konto/ustaw-haslo',
}

const base = (overrides: Partial<AccountsOptions> = {}): AccountsOptions => ({
  paths,
  storefrontUrl: 'https://shop.example',
  ...overrides,
})

describe('resolveOptions', () => {
  const env = process.env.STOREFRONT_URL
  afterEach(() => {
    if (env === undefined) delete process.env.STOREFRONT_URL
    else process.env.STOREFRONT_URL = env
  })

  it('fills in locale pl, the dictionary and the throttle defaults', () => {
    const resolved = resolveOptions(base())
    expect(resolved.locale).toBe('pl')
    expect(resolved.messages).toEqual(messages.pl)
    expect(resolved.paths).toEqual(paths)
    expect(resolved.onAccountDeleted).toEqual([])
    expect(resolved.resolveContact).toBeNull()
    expect(resolved.emailThrottle).toEqual({ max: 3, windowMs: 15 * 60 * 1000 })
  })

  it('ignores undefined overrides', () => {
    const resolved = resolveOptions(
      base({
        locale: undefined,
        emailThrottle: undefined,
        messages: { linkExpired: undefined, wrongPassword: 'Wrong.' },
      }),
    )
    expect(resolved.locale).toBe('pl')
    expect(resolved.emailThrottle.max).toBe(3)
    expect(resolved.messages.linkExpired).toBe(messages.pl.linkExpired)
    expect(resolved.messages.wrongPassword).toBe('Wrong.')
  })

  it('uses the en dictionary', () => {
    expect(resolveOptions(base({ locale: 'en' })).messages).toEqual(messages.en)
  })

  it('throws without paths', () => {
    expect(() => resolveOptions({} as unknown as AccountsOptions)).toThrow(/paths/)
    expect(() =>
      resolveOptions({ paths: { confirmEmail: '/a' } } as unknown as AccountsOptions),
    ).toThrow(/paths\.passwordReset/)
    expect(() => resolveOptions(base({ paths: { ...paths, setPassword: '' } }))).toThrow(
      /paths\.setPassword/,
    )
  })

  it('throws on an unknown locale', () => {
    expect(() => resolveOptions(base({ locale: 'de' as never }))).toThrow(/unknown locale "de"/)
  })

  it('strips trailing slashes from storefrontUrl', () => {
    expect(resolveOptions(base({ storefrontUrl: 'https://shop.example///' })).storefrontUrl).toBe(
      'https://shop.example',
    )
  })

  it('takes storefrontUrl from STOREFRONT_URL when not given', () => {
    process.env.STOREFRONT_URL = 'https://env.example/'
    expect(resolveOptions(base({ storefrontUrl: undefined })).storefrontUrl).toBe(
      'https://env.example',
    )
    delete process.env.STOREFRONT_URL
    expect(resolveOptions(base({ storefrontUrl: undefined })).storefrontUrl).toBeNull()
  })

  it('passes resolveContact, onAccountDeleted and emailThrottle through', () => {
    const resolveContact = async () => null
    const hook = async () => {}
    const resolved = resolveOptions(
      base({
        resolveContact,
        onAccountDeleted: [hook],
        emailThrottle: { max: 5, windowMs: 1000 },
      }),
    )
    expect(resolved.resolveContact).toBe(resolveContact)
    expect(resolved.onAccountDeleted).toEqual([hook])
    expect(resolved.emailThrottle).toEqual({ max: 5, windowMs: 1000 })
  })

  it('deletedEmail defaults to the neutral form and passes a custom function through', () => {
    expect(resolveOptions(base()).deletedEmail('cus_1')).toBe(
      'deleted+cus_1@account-deleted.invalid',
    )
    const custom = (id: string) => `gone+${id}@example.invalid`
    expect(resolveOptions(base({ deletedEmail: custom })).deletedEmail).toBe(custom)
    expect(resolveOptions(base({ deletedEmail: undefined })).deletedEmail('x')).toContain('x')
  })

  it('rejects a deletedEmail that is not a function', () => {
    expect(() => resolveOptions(base({ deletedEmail: 'x@y.pl' as never }))).toThrow(/deletedEmail/)
  })

  it('rejects an invalid emailThrottle', () => {
    expect(() => resolveOptions(base({ emailThrottle: { max: 0, windowMs: 1000 } }))).toThrow(
      /emailThrottle/,
    )
  })
})

import { fakturowniaConfig, fakturowniaWarnings } from '../config'

describe('fakturowniaConfig', () => {
  it('is off without FAKTUROWNIA_URL', () => {
    expect(fakturowniaConfig({})).toBeNull()
    expect(fakturowniaConfig({ FAKTUROWNIA_URL: '  ' })).toBeNull()
  })

  it('is off when the API address comes without a token', () => {
    expect(fakturowniaConfig({ FAKTUROWNIA_URL: 'https://shop.fakturownia.pl/' })).toBeNull()
  })

  it('talks to the API with an address and a token', () => {
    expect(
      fakturowniaConfig({
        FAKTUROWNIA_URL: 'https://shop.fakturownia.pl/',
        FAKTUROWNIA_API_TOKEN: 'tok-1',
      }),
    ).toEqual({
      client: 'api',
      url: 'https://shop.fakturownia.pl',
      token: 'tok-1',
      departmentId: null,
      ksef: 'off',
      oidPrefix: 'INV-',
    })
  })

  it('takes the department, the KSeF mode and the oid prefix from env', () => {
    expect(
      fakturowniaConfig({
        FAKTUROWNIA_URL: 'https://shop.fakturownia.pl',
        FAKTUROWNIA_API_TOKEN: 'tok-1',
        FAKTUROWNIA_DEPARTMENT_ID: '42',
        FAKTUROWNIA_KSEF: 'companies',
        FAKTUROWNIA_OID_PREFIX: 'INV-STG-',
      }),
    ).toMatchObject({ departmentId: '42', ksef: 'companies', oidPrefix: 'INV-STG-' })
  })

  it('falls back to KSeF off for an unknown mode', () => {
    const env = {
      FAKTUROWNIA_URL: 'https://shop.fakturownia.pl',
      FAKTUROWNIA_API_TOKEN: 'tok-1',
      FAKTUROWNIA_KSEF: 'tak',
    }
    expect(fakturowniaConfig(env)?.ksef).toBe('off')
    expect(fakturowniaWarnings(env)).toEqual([
      '[Fakturownia] FAKTUROWNIA_KSEF="tak" – dozwolone off, companies, all; przyjmuję off.',
    ])
  })

  it('uses the in-process fake for „atrapa” outside production', () => {
    expect(fakturowniaConfig({ FAKTUROWNIA_URL: 'atrapa' })).toEqual({
      client: 'fake',
      url: null,
      token: null,
      departmentId: null,
      ksef: 'off',
      oidPrefix: 'INV-',
    })
  })

  it('never uses the fake in production', () => {
    const env = { FAKTUROWNIA_URL: 'atrapa', NODE_ENV: 'production' }
    expect(fakturowniaConfig(env)).toBeNull()
    expect(fakturowniaWarnings(env)).toEqual([
      '[Fakturownia] FAKTUROWNIA_URL=atrapa w produkcji – faktury nie są wystawiane.',
    ])
  })
})

describe('fakturowniaWarnings', () => {
  it('warns about an address without a token', () => {
    expect(fakturowniaWarnings({ FAKTUROWNIA_URL: 'https://shop.fakturownia.pl' })).toEqual([
      '[Fakturownia] FAKTUROWNIA_URL bez FAKTUROWNIA_API_TOKEN – faktury nie są wystawiane.',
    ])
  })

  it('stays quiet for a complete setup and without Fakturownia', () => {
    expect(
      fakturowniaWarnings({
        FAKTUROWNIA_URL: 'https://shop.fakturownia.pl',
        FAKTUROWNIA_API_TOKEN: 'tok-1',
        FAKTUROWNIA_KSEF: 'all',
      }),
    ).toEqual([])
    expect(fakturowniaWarnings({})).toEqual([])
  })

  it('takes the oid prefix of the shop unless the env sets one', () => {
    const env = { FAKTUROWNIA_URL: 'https://shop.fakturownia.pl', FAKTUROWNIA_API_TOKEN: 't' }
    expect(fakturowniaConfig(env, 'SHOP-')).toMatchObject({ oidPrefix: 'SHOP-' })
    expect(fakturowniaConfig({ ...env, FAKTUROWNIA_OID_PREFIX: 'ENV-' }, 'SHOP-')).toMatchObject({
      oidPrefix: 'ENV-',
    })
  })

  it('starts the warnings with the log prefix of the shop', () => {
    const env = { FAKTUROWNIA_URL: 'atrapa', NODE_ENV: 'production' }
    expect(fakturowniaWarnings(env, '[X]')[0]).toMatch(/^\[X\] /)
  })
})

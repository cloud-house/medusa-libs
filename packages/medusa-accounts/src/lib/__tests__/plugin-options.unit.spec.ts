import { accountsOptions } from '../plugin-options'

describe('accountsOptions', () => {
  it('returns the options of the accounts module', () => {
    const options = { locale: 'pl' }
    const scope = { resolve: () => ({ getOptions: () => options }) }
    expect(accountsOptions(scope as never)).toBe(options)
  })

  it('throws a clear error when the module is not registered', () => {
    const scope = {
      resolve: () => {
        throw new Error('Could not resolve accounts')
      },
    }
    expect(() => accountsOptions(scope as never)).toThrow(
      /medusa-accounts: the `accounts` module is not registered/,
    )
  })
})

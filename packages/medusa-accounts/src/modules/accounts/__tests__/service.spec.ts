import { moduleIntegrationTestRunner } from '@medusajs/test-utils'
import { ACCOUNTS_MODULE } from '..'
import type AccountsModuleService from '../service'

jest.setTimeout(60 * 1000)

moduleIntegrationTestRunner<AccountsModuleService>({
  moduleName: ACCOUNTS_MODULE,
  moduleModels: [],
  moduleOptions: {
    paths: { confirmEmail: '/a', passwordReset: '/b', setPassword: '/c' },
    storefrontUrl: 'https://shop.example/',
    locale: 'en',
  },
  resolve: './src/modules/accounts',
  testSuite: ({ service }) => {
    describe('AccountsModuleService', () => {
      it('hands the resolved plugin options to whoever resolves the module', () => {
        const options = service.getOptions()
        expect(options.paths.passwordReset).toBe('/b')
        expect(options.storefrontUrl).toBe('https://shop.example')
        expect(options.locale).toBe('en')
        expect(options.messages.linkExpired).toBe('The link has expired or has already been used.')
        expect(options.emailThrottle).toEqual({ max: 3, windowMs: 15 * 60 * 1000 })
      })
    })
  },
})

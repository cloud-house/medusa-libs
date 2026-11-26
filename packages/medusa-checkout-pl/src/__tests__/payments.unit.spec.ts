import { STRIPE_PROVIDERS } from '@cloud-house/commerce-rules'
import { paymentModules, regionPaymentProviders } from '../payments'

describe('paymentModules', () => {
  it('registers no payment module without a Stripe key', () => {
    expect(paymentModules({})).toEqual([])
  })

  it('registers Stripe with immediate capture and async BLIK and P24', () => {
    expect(
      paymentModules({ STRIPE_API_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_x' }),
    ).toEqual([
      {
        resolve: '@medusajs/medusa/payment',
        options: {
          providers: [
            {
              resolve: '@medusajs/medusa/payment-stripe',
              id: 'stripe',
              options: {
                apiKey: 'sk_test_x',
                webhookSecret: 'whsec_x',
                capture: true,
                asyncPaymentMethodTypes: ['blik', 'p24'],
              },
            },
          ],
        },
      },
    ])
  })
})

describe('regionPaymentProviders', () => {
  it('uses only card, BLIK and P24 when Stripe is registered – no system payment', () => {
    expect(
      regionPaymentProviders([...STRIPE_PROVIDERS, 'pp_stripe-ideal_stripe', 'pp_system_default']),
    ).toEqual(STRIPE_PROVIDERS)
  })

  it('falls back to the system provider without Stripe', () => {
    expect(regionPaymentProviders(['pp_system_default'])).toEqual(['pp_system_default'])
  })
})

describe('paymentModules with options', () => {
  it('the EU variant has no async methods', () => {
    const [module] = paymentModules({ STRIPE_API_KEY: 'sk' }, { asyncPaymentMethodTypes: [] }) as {
      options: { providers: { options: { asyncPaymentMethodTypes: string[] } }[] }
    }[]
    expect(module?.options.providers[0]?.options.asyncPaymentMethodTypes).toEqual([])
  })
})

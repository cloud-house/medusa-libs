import { describe, expect, it } from 'vitest'
import { resolvePaymentReturn } from './payment-return'

const cart = {
  id: 'cart_1',
  payment_collection: {
    id: 'paycol_1',
    payment_sessions: [
      { provider_id: 'pp_stripe-przelewy24_stripe', data: { client_secret: 'pi_1_secret_ok' } },
    ],
  },
}

describe('resolvePaymentReturn', () => {
  it('completes when Stripe sends back the secret of this cart session', () => {
    expect(
      resolvePaymentReturn({ clientSecret: 'pi_1_secret_ok', redirectStatus: 'succeeded', cart }),
    ).toBe('complete')
    expect(
      resolvePaymentReturn({ clientSecret: 'pi_1_secret_ok', redirectStatus: 'processing', cart }),
    ).toBe('complete')
  })

  it('a cancelled payment, a foreign secret or no cart is a failure', () => {
    expect(
      resolvePaymentReturn({ clientSecret: 'pi_1_secret_ok', redirectStatus: 'failed', cart }),
    ).toBe('failed')
    expect(
      resolvePaymentReturn({
        clientSecret: 'pi_2_secret_other',
        redirectStatus: 'succeeded',
        cart,
      }),
    ).toBe('failed')
    expect(resolvePaymentReturn({ clientSecret: null, redirectStatus: 'succeeded', cart })).toBe(
      'failed',
    )
    expect(
      resolvePaymentReturn({ clientSecret: 'pi_1_secret_ok', redirectStatus: null, cart }),
    ).toBe('failed')
    expect(
      resolvePaymentReturn({
        clientSecret: 'pi_1_secret_ok',
        redirectStatus: 'succeeded',
        cart: null,
      }),
    ).toBe('failed')
  })
})

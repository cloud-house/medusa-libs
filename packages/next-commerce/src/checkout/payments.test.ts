import type { Stripe, StripeElements } from '@stripe/stripe-js'
import { describe, expect, it, vi } from 'vitest'
import { createStripePayments } from './payments'

const ctx = {
  blikCode: '123456',
  email: 'jan@example.pl',
  returnUrl: 'http://x/zamowienie/platnosc',
}
const intent = (status: string) => ({ paymentIntent: { status } })

function fakeStripe(result: unknown) {
  const stripe = {
    confirmBlikPayment: vi.fn(async () => result),
    confirmP24Payment: vi.fn(async () => result),
    confirmPayment: vi.fn(async () => result),
  }
  const elements = { submit: vi.fn(async () => ({})) }
  return {
    stripe,
    elements,
    adapter: createStripePayments(
      stripe as unknown as Stripe,
      elements as unknown as StripeElements,
    ),
  }
}

describe('createStripePayments', () => {
  it('BLIK sends the code and waits for the bank app', async () => {
    const { stripe, adapter } = fakeStripe(intent('succeeded'))

    expect(await adapter.confirm('blik', 'pi_secret', ctx)).toEqual({ status: 'succeeded' })
    expect(stripe.confirmBlikPayment).toHaveBeenCalledWith('pi_secret', {
      payment_method: { blik: {} },
      payment_method_options: { blik: { code: '123456' } },
    })
  })

  it('Przelewy24 redirects to the bank with the return address', async () => {
    const { stripe, adapter } = fakeStripe({})

    expect(await adapter.confirm('p24', 'pi_secret', ctx)).toEqual({ status: 'redirect' })
    expect(stripe.confirmP24Payment).toHaveBeenCalledWith('pi_secret', {
      payment_method: { billing_details: { email: 'jan@example.pl' } },
      return_url: 'http://x/zamowienie/platnosc',
    })
  })

  it('the card stays on the page unless the bank needs a redirect', async () => {
    const { stripe, elements, adapter } = fakeStripe(intent('processing'))

    expect(await adapter.confirm('card', 'pi_secret', ctx)).toEqual({ status: 'processing' })
    expect(stripe.confirmPayment).toHaveBeenCalledWith({
      elements,
      clientSecret: 'pi_secret',
      confirmParams: { return_url: 'http://x/zamowienie/platnosc' },
      redirect: 'if_required',
    })
  })

  it('a Stripe error becomes a failure with its message', async () => {
    const { adapter } = fakeStripe({ error: { message: 'Kod BLIK jest nieprawidłowy.' } })

    expect(await adapter.confirm('blik', 'pi_secret', ctx)).toEqual({
      status: 'failed',
      message: 'Kod BLIK jest nieprawidłowy.',
    })
  })

  it('prepareCard returns the card form error or null', async () => {
    const { elements, adapter } = fakeStripe({})
    expect(await adapter.prepareCard()).toBeNull()

    elements.submit.mockResolvedValueOnce({ error: { message: 'Numer karty jest niepełny.' } })
    expect(await adapter.prepareCard()).toBe('Numer karty jest niepełny.')
  })
})

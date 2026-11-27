import type { PaymentIntentResult, Stripe, StripeElements } from '@stripe/stripe-js'
import type { PaymentMethod } from './form'

export type PaymentStatus =
  | { status: 'succeeded' | 'processing' }
  /** Przeglądarka przechodzi do banku (P24, 3D Secure) – wróci na `returnUrl`. */
  | { status: 'redirect' }
  | { status: 'failed'; message: string }

/** Potwierdzanie płatności w Stripe.js – wstrzykiwane, żeby stronę dało się testować bez Stripe. */
export interface PaymentsAdapter {
  confirm(
    method: PaymentMethod,
    clientSecret: string,
    ctx: { blikCode: string; email: string; returnUrl: string },
  ): Promise<PaymentStatus>
  /** `elements.submit()` formularza karty przed założeniem sesji; błąd → komunikat. */
  prepareCard(): Promise<string | null>
}

const DECLINED = 'Płatność nie powiodła się. Spróbuj ponownie albo wybierz inną metodę.'

function toStatus(result: PaymentIntentResult, method: PaymentMethod): PaymentStatus {
  if (result.error) return { status: 'failed', message: result.error.message || DECLINED }
  const status = result.paymentIntent?.status
  // confirmP24Payment bez błędu oznacza przekierowanie do banku.
  if (!status)
    return method === 'blik' ? { status: 'failed', message: DECLINED } : { status: 'redirect' }
  if (status === 'succeeded' || status === 'requires_capture') return { status: 'succeeded' }
  if (status === 'processing') return { status: 'processing' }
  return { status: 'failed', message: DECLINED }
}

export function createStripePayments(
  stripe: Stripe,
  elements: StripeElements | null,
): PaymentsAdapter {
  return {
    async prepareCard() {
      if (!elements) return 'Formularz karty jeszcze się ładuje – spróbuj za chwilę.'
      const { error } = await elements.submit()
      return error ? error.message || 'Sprawdź dane karty.' : null
    },
    async confirm(method, clientSecret, ctx) {
      if (method === 'blik') {
        const result = await stripe.confirmBlikPayment(clientSecret, {
          payment_method: { blik: {} },
          payment_method_options: { blik: { code: ctx.blikCode } },
        })
        return toStatus(result, method)
      }
      if (method === 'p24') {
        const result = await stripe.confirmP24Payment(clientSecret, {
          payment_method: { billing_details: { email: ctx.email } },
          return_url: ctx.returnUrl,
        })
        return toStatus(result, method)
      }
      if (!elements) return { status: 'failed', message: DECLINED }
      const result = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: { return_url: ctx.returnUrl },
        redirect: 'if_required',
      })
      return toStatus(result, method)
    },
  }
}

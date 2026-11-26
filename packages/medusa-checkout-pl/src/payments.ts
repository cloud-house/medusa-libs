import { STRIPE_PROVIDERS } from '@cloud-house/commerce-rules'

export const SYSTEM_PROVIDER = 'pp_system_default'

export interface PaymentModulesOptions {
  /** Stripe methods that settle later; default `['blik', 'p24']` – `[]` for the EU. */
  asyncPaymentMethodTypes?: string[]
}

/**
 * Stripe (card, BLIK, P24 – one `payment-stripe` entry) only when `STRIPE_API_KEY` is set; without
 * it the backend starts with the system provider alone. Payment is captured at once (BLIK and P24
 * cannot authorize separately); BLIK and P24 still „processing” create the order and the Stripe
 * webhook settles it later. Call it from `medusa-config.ts` (`modules`), it needs no container.
 */
export function paymentModules(
  env: Record<string, string | undefined>,
  options: PaymentModulesOptions = {},
): Record<string, unknown>[] {
  const apiKey = env.STRIPE_API_KEY
  if (!apiKey) return []
  return [
    {
      resolve: '@medusajs/medusa/payment',
      options: {
        providers: [
          {
            resolve: '@medusajs/medusa/payment-stripe',
            id: 'stripe',
            options: {
              apiKey,
              webhookSecret: env.STRIPE_WEBHOOK_SECRET,
              capture: true,
              asyncPaymentMethodTypes: options.asyncPaymentMethodTypes ?? ['blik', 'p24'],
            },
          },
        ],
      },
    },
  ]
}

/**
 * Payment providers of the shop's region: the three Stripe methods once all are registered –
 * without the system provider, which would let the Store API place unpaid orders – otherwise the
 * system provider (dev and integration tests without keys).
 */
export function regionPaymentProviders(registered: string[]): string[] {
  return STRIPE_PROVIDERS.every((id) => registered.includes(id))
    ? [...STRIPE_PROVIDERS]
    : [SYSTEM_PROVIDER]
}

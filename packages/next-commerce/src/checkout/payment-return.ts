/** Statusy `redirect_status`, po których Medusa może złożyć zamówienie (sama sprawdza intent w Stripe). */
const PAID_OR_PENDING = new Set(['succeeded', 'processing'])

interface ReturnCart {
  payment_collection?: {
    payment_sessions?: { data?: Record<string, unknown> | null }[] | null
  } | null
}

/**
 * Powrót z przekierowania płatności (Przelewy24). Zamówienie składamy tylko dla sekretu sesji
 * z koszyka tej przeglądarki – sfałszowany albo cudzy `payment_intent_client_secret` kończy się
 * powrotem do checkoutu bez zmian w koszyku.
 */
export function resolvePaymentReturn(input: {
  clientSecret: string | null
  redirectStatus: string | null
  cart: ReturnCart | null
}): 'complete' | 'failed' {
  const { clientSecret, redirectStatus, cart } = input
  if (!cart || !clientSecret || !redirectStatus || !PAID_OR_PENDING.has(redirectStatus)) {
    return 'failed'
  }
  const sessions = cart.payment_collection?.payment_sessions ?? []
  return sessions.some((session) => session.data?.client_secret === clientSecret)
    ? 'complete'
    : 'failed'
}

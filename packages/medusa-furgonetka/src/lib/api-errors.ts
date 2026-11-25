export const NO_FUNDS_MESSAGE =
  'Brak środków na koncie Furgonetki – doładuj saldo i spróbuj ponownie'

/**
 * `transient` – worth another try (network, timeout, 5xx, 408, 429, a carrier that could not be
 * reached); `auth` – the token or the application keys are no longer accepted; `no_funds` – the
 * balance does not cover the order; `terms` – the carrier terms are not accepted in Furgonetka;
 * `not_found` – no such resource; `permanent` – anything else, retrying will not help.
 */
export type FurgonetkaErrorKind =
  | 'transient'
  | 'permanent'
  | 'no_funds'
  | 'auth'
  | 'not_found'
  | 'terms'

export class FurgonetkaError extends Error {
  constructor(
    readonly kind: FurgonetkaErrorKind,
    message: string,
    readonly status: number | null = null,
  ) {
    super(message)
    this.name = 'FurgonetkaError'
  }
}

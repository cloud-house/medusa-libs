/**
 * Captured, or authorized – the system provider of dev only authorizes; Stripe captures at once
 * (`capture: true`). A partial refund (a return) does not undo the sale. The `payment_status` of an
 * order in these states counts as paid for the invoice (spec 6c) and the shipping list (spec 6d).
 */
export const PAID_STATUSES = new Set(['captured', 'authorized', 'partially_refunded'])

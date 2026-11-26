/**
 * `order.metadata.delivery_review` – why the staff has to look at the delivery of a paid order:
 * a bulky item (a board or a „Tylko kurier” product) in an order for a parcel locker, or for the
 * InPost courier, which does not carry it.
 */
export type DeliveryReview = 'board_to_parcel_locker' | 'bulky_with_inpost_courier'

/** What the customer reads about the review on the confirmation page and in the e-mail. */
export const DELIVERY_REVIEW_NOTES: Record<DeliveryReview, string> = {
  board_to_parcel_locker:
    'Część zamówienia nie zmieści się w paczkomacie – wyślemy ją kurierem pod adres z zamówienia.',
  bulky_with_inpost_courier:
    'Produkt, który wysyłamy tylko kurierem DPD, pojedzie kurierem DPD zamiast Kuriera InPost.',
}

/**
 * Reads `delivery_review` of an order. Orders flagged before there was a second value carry
 * other text, and that is the parcel locker case; no value – no review.
 */
export function deliveryReviewOf(value: unknown): DeliveryReview | null {
  if (value === 'bulky_with_inpost_courier') return value
  return typeof value === 'string' && value !== '' ? 'board_to_parcel_locker' : null
}

import { describe, expect, it } from 'vitest'
import { DELIVERY_REVIEW_NOTES, deliveryReviewOf } from './delivery-review'

describe('deliveryReviewOf', () => {
  it('reads both known values', () => {
    expect(deliveryReviewOf('bulky_with_inpost_courier')).toBe('bulky_with_inpost_courier')
    expect(deliveryReviewOf('board_to_parcel_locker')).toBe('board_to_parcel_locker')
  })

  it('treats any other non-empty text as the older parcel locker flag', () => {
    expect(deliveryReviewOf('x')).toBe('board_to_parcel_locker')
  })

  it('returns null for an empty or missing value', () => {
    expect(deliveryReviewOf('')).toBeNull()
    expect(deliveryReviewOf(undefined)).toBeNull()
    expect(deliveryReviewOf(null)).toBeNull()
  })
})

describe('DELIVERY_REVIEW_NOTES', () => {
  it('has a customer note for every value', () => {
    expect(DELIVERY_REVIEW_NOTES).toEqual({
      board_to_parcel_locker:
        'Część zamówienia nie zmieści się w paczkomacie – wyślemy ją kurierem pod adres z zamówienia.',
      bulky_with_inpost_courier:
        'Produkt, który wysyłamy tylko kurierem DPD, pojedzie kurierem DPD zamiast Kuriera InPost.',
    })
  })
})

describe('STRIPE_PROVIDERS', () => {
  it('lists the provider ids of card, BLIK and Przelewy24', async () => {
    const { STRIPE_PROVIDER_IDS, STRIPE_PROVIDERS } = await import('./api-types')
    expect(STRIPE_PROVIDER_IDS).toEqual({
      card: 'pp_stripe_stripe',
      blik: 'pp_stripe-blik_stripe',
      p24: 'pp_stripe-przelewy24_stripe',
    })
    expect(STRIPE_PROVIDERS).toEqual(Object.values(STRIPE_PROVIDER_IDS))
  })
})

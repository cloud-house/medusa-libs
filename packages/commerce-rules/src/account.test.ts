import { describe, expect, it } from 'vitest'
import { ORDER_STATUS_LABELS, orderStatus, orderStatusTone, PASSWORD_MIN_LENGTH } from './account'

const paid = { status: 'pending', payment_status: 'captured', fulfillment_status: 'not_fulfilled' }

describe('orderStatus', () => {
  it('anulowane wygrywa z płatnością i wysyłką', () => {
    expect(
      orderStatus({
        status: 'canceled',
        payment_status: 'captured',
        fulfillment_status: 'shipped',
      }),
    ).toBe('canceled')
  })

  it('zwrot pieniędzy – całość lub część', () => {
    expect(orderStatus({ ...paid, payment_status: 'refunded' })).toBe('refunded')
    expect(
      orderStatus({
        ...paid,
        payment_status: 'partially_refunded',
        fulfillment_status: 'delivered',
      }),
    ).toBe('refunded')
  })

  it('dostarczone', () => {
    expect(orderStatus({ ...paid, fulfillment_status: 'delivered' })).toBe('delivered')
  })

  it('wysłane – także częściowo i częściowo dostarczone', () => {
    expect(orderStatus({ ...paid, fulfillment_status: 'shipped' })).toBe('shipped')
    expect(orderStatus({ ...paid, fulfillment_status: 'partially_shipped' })).toBe('shipped')
    expect(orderStatus({ ...paid, fulfillment_status: 'partially_delivered' })).toBe('shipped')
  })

  it('płatność niezakończona', () => {
    for (const payment_status of ['awaiting', 'not_paid', 'requires_action']) {
      expect(orderStatus({ ...paid, payment_status })).toBe('awaiting_payment')
    }
  })

  it('opłacone albo autoryzowane, przed wysyłką – przyjęte', () => {
    expect(orderStatus(paid)).toBe('placed')
    expect(
      orderStatus({
        status: 'pending',
        payment_status: 'authorized',
        fulfillment_status: 'fulfilled',
      }),
    ).toBe('placed')
  })
})

describe('ORDER_STATUS_LABELS i orderStatusTone', () => {
  it('teksty statusów', () => {
    expect(ORDER_STATUS_LABELS).toEqual({
      awaiting_payment: 'Czeka na płatność',
      placed: 'Przyjęte',
      shipped: 'Wysłane',
      delivered: 'Dostarczone',
      canceled: 'Anulowane',
      refunded: 'Zwrot pieniędzy',
    })
  })

  it('kolory odznak', () => {
    expect(orderStatusTone('delivered')).toBe('success')
    expect(orderStatusTone('canceled')).toBe('muted')
    expect(orderStatusTone('refunded')).toBe('muted')
    expect(orderStatusTone('placed')).toBe('progress')
    expect(orderStatusTone('shipped')).toBe('progress')
    expect(orderStatusTone('awaiting_payment')).toBe('progress')
  })
})

describe('reguły konta', () => {
  it('hasło ma co najmniej 8 znaków', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8)
  })
})

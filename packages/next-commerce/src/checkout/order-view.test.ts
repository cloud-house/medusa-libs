import { describe, expect, it } from 'vitest'
import { TEST_VARIANT_OPTIONS } from '../cart/test-cart'
import { SHOP_VIEW_OPTIONS } from '../cart/test-shop-options'
import { toOrderView } from './order-view'
import { testOrder } from './test-order'

describe('toOrderView', () => {
  it('przekazuje kody wpisane przez klienta (kupon w zdarzeniu zakupu)', () => {
    expect(toOrderView(testOrder({ codes: ['LATO10'] }), {}, SHOP_VIEW_OPTIONS).codes).toEqual([
      'LATO10',
    ])
    expect(toOrderView(testOrder(), {}, SHOP_VIEW_OPTIONS).codes).toEqual([])
  })

  it('groups the upgrade under its board like the cart and keeps the totals', () => {
    const view = toOrderView(testOrder(), TEST_VARIANT_OPTIONS, SHOP_VIEW_OPTIONS)

    expect(view.groups.map((g) => [g.line.id, g.upgrades.map((u) => u.id)])).toEqual([
      ['oi_board', ['oi_paddle']],
      ['oi_vest', []],
    ])
    expect(view.groups[0]?.upgrades[0]).toMatchObject({
      title: 'Wiosło Carbon Pro',
      replaces: 'Wiosło alu 3-cz.',
      discount: { label: 'Rabat', code: 0 },
    })
    expect(view).toMatchObject({
      displayId: 1001,
      email: 'jan@example.pl',
      originalItemTotal: 2847,
      discount: 299.6,
      shippingTotal: 0,
      taxTotal: 476.35,
      total: 2547.4,
      paid: true,
      deliveryReview: null,
      invoice: null,
    })
  })

  it('a courier shows the name and the address', () => {
    expect(toOrderView(testOrder(), {}, SHOP_VIEW_OPTIONS).delivery).toEqual({
      name: 'Kurier DPD',
      lines: ['Jan Kowalski', 'ul. Morska 5', '80-001 Gdańsk', 'tel. +48600100200'],
    })
  })

  it('a parcel locker shows its code and the point address', () => {
    const order = testOrder({
      shipping_method: {
        name: 'Paczkomat InPost',
        code: 'paczkomat-inpost',
        amount: 12.99,
        data: { parcel_locker: 'KRA01M', parcel_locker_label: 'ul. Krakowska 1, 30-001 Kraków' },
      },
      metadata: { delivery_review: 'board_to_parcel_locker' },
    })

    const view = toOrderView(order, {}, SHOP_VIEW_OPTIONS)
    expect(view.delivery).toEqual({
      name: 'Paczkomat InPost',
      lines: ['Paczkomat KRA01M', 'ul. Krakowska 1, 30-001 Kraków'],
    })
    expect(view.deliveryReview).toBe('board_to_parcel_locker')
  })

  it('delivery review: the InPost courier case keeps its value, no flag means none', () => {
    const flagged = testOrder({ metadata: { delivery_review: 'bulky_with_inpost_courier' } })

    expect(toOrderView(flagged, {}, SHOP_VIEW_OPTIONS).deliveryReview).toBe(
      'bulky_with_inpost_courier',
    )
    expect(toOrderView(testOrder(), {}, SHOP_VIEW_OPTIONS).deliveryReview).toBeNull()
  })

  it('the invoice has the company, NIP and the billing address', () => {
    const order = testOrder({
      billing_address: {
        ...testOrder().shipping_address,
        company: 'Sup Sp. z o.o.',
        address_1: 'ul. Biurowa 1',
      } as never,
      metadata: { nip: '5260250274' },
    })

    expect(toOrderView(order, {}, SHOP_VIEW_OPTIONS).invoice).toEqual({
      company: 'Sup Sp. z o.o.',
      nip: '5260250274',
      lines: ['ul. Biurowa 1', '80-001 Gdańsk'],
    })
  })

  it('uwagi do zamówienia z metadanych; puste – null', () => {
    expect(
      toOrderView(testOrder({ metadata: { customer_note: 'Domofon 12' } }), {}, SHOP_VIEW_OPTIONS)
        .customerNote,
    ).toBe('Domofon 12')
    expect(toOrderView(testOrder(), {}, SHOP_VIEW_OPTIONS).customerNote).toBeNull()
  })

  it('paid only for captured or authorized payments', () => {
    for (const [status, paid] of [
      ['captured', true],
      ['authorized', true],
      ['awaiting', false],
      ['not_paid', false],
    ] as const) {
      expect(toOrderView(testOrder({ payment_status: status }), {}, SHOP_VIEW_OPTIONS).paid).toBe(
        paid,
      )
    }
  })
})

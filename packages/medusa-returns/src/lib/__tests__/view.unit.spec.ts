import {
  RETURN_MESSAGES,
  type ReturnQuantities,
  returnExpiredMessage,
} from '@cloud-house/commerce-rules'
import type { ReturnOrder, ReturnOrderItem, ReturnRow } from '../../types'
import { NOT_SHOP_ORDER_MESSAGE, quantitiesOf, toAccountReturn, toReturnInfo } from '../view'

const NOW = new Date('2026-10-20T10:00:00Z')

function item(
  id: string,
  title: string,
  quantities: Partial<ReturnQuantities> = {},
  variant: string | null = null,
): ReturnOrderItem {
  return {
    id,
    title,
    variant,
    thumbnail: null,
    quantities: { quantity: 2, shipped: 2, requested: 0, received: 0, dismissed: 0, ...quantities },
  }
}

const DELIVERED = {
  shippedAt: '2026-10-17T09:00:00.000Z',
  deliveredAt: '2026-10-19T12:00:00.000Z',
  canceledAt: null,
}

function order(over: Partial<ReturnOrder> = {}): ReturnOrder {
  return {
    id: 'order_1',
    displayId: 1042,
    email: 'jan@example.pl',
    shopOrder: true,
    canceled: false,
    items: [item('item_pump', 'Pompka elektryczna')],
    fulfillments: [DELIVERED],
    returns: [],
    ...over,
  }
}

function returnRow(over: Partial<ReturnRow> = {}): ReturnRow {
  return {
    id: 'ret_1',
    displayId: 1,
    orderId: 'order_1',
    status: 'requested',
    requestedAt: new Date('2026-10-19T15:00:00Z'),
    receivedAt: null,
    noNotification: false,
    items: [
      {
        itemId: 'item_pump',
        quantity: 1,
        receivedQuantity: 0,
        reason: 'mind_changed',
        note: null,
      },
    ],
    ...over,
  }
}

describe('toReturnInfo', () => {
  it('shipped goods within the window: eligible, the items with something left, the window', () => {
    const info = toReturnInfo(
      order({
        items: [
          item('item_pump', 'Pompka elektryczna'),
          item('item_leash', 'Leash spiralny', { requested: 1 }, "10'"),
          item('item_done', 'Wiosło', { shipped: 1, quantity: 1, requested: 1 }),
        ],
      }),
      30,
      NOW,
    )

    expect(info).toEqual({
      eligible: true,
      blocked: null,
      window: {
        source: 'delivered',
        started_at: '2026-10-19T12:00:00.000Z',
        last_day: '2026-11-18',
        days: 30,
      },
      items: [
        {
          id: 'item_pump',
          title: 'Pompka elektryczna',
          variant: null,
          thumbnail: null,
          returnable: 2,
        },
        {
          id: 'item_leash',
          title: 'Leash spiralny',
          variant: "10'",
          thumbnail: null,
          returnable: 1,
        },
      ],
      returns: [],
    })
  })

  it('only the dispatch date known: the window runs from it', () => {
    const info = toReturnInfo(
      order({
        fulfillments: [
          { shippedAt: '2026-10-19T09:00:00.000Z', deliveredAt: null, canceledAt: null },
        ],
      }),
      30,
      NOW,
    )

    expect(info.eligible).toBe(true)
    expect(info.window).toMatchObject({ source: 'shipped', started_at: '2026-10-19T09:00:00.000Z' })
  })

  it('canceled order: blocked as canceled, even when it was shipped', () => {
    const info = toReturnInfo(order({ canceled: true }), 30, NOW)

    expect(info).toMatchObject({ eligible: false, blocked: RETURN_MESSAGES.canceled })
  })

  it('an order not placed in the shop (a converted admin draft): blocked, return it by e-mail', () => {
    const info = toReturnInfo(order({ shopOrder: false }), 30, NOW)

    expect(info).toMatchObject({ eligible: false, blocked: NOT_SHOP_ORDER_MESSAGE })
    // Fixed text, no settings: it names the page with the contact, not an address.
    expect(NOT_SHOP_ORDER_MESSAGE).toBe(
      'Zwrot tego zamówienia zgłoś e-mailem – adres znajdziesz na stronie „Dostawa i zwroty”.',
    )
    // The window and the items stay as they are: the order page still shows the window.
    expect(info.window).toMatchObject({ source: 'delivered' })
    expect(info.items).toHaveLength(1)
  })

  it('a canceled order that was not placed in the shop is blocked as canceled', () => {
    const info = toReturnInfo(order({ shopOrder: false, canceled: true }), 30, NOW)

    expect(info.blocked).toBe(RETURN_MESSAGES.canceled)
  })

  it('nothing shipped: blocked as not shipped, no window', () => {
    const info = toReturnInfo(
      order({
        items: [item('item_pump', 'Pompka elektryczna', { shipped: 0 })],
        fulfillments: [{ shippedAt: null, deliveredAt: null, canceledAt: null }],
      }),
      30,
      NOW,
    )

    expect(info).toMatchObject({
      eligible: false,
      blocked: RETURN_MESSAGES.notShipped,
      window: null,
      items: [],
    })
  })

  it('only a canceled fulfillment: nothing was shipped', () => {
    const info = toReturnInfo(
      order({ fulfillments: [{ ...DELIVERED, canceledAt: '2026-10-18T09:00:00.000Z' }] }),
      30,
      NOW,
    )

    expect(info).toMatchObject({ eligible: false, blocked: RETURN_MESSAGES.notShipped })
  })

  it('after the last day: blocked with the length of the window in the text', () => {
    const info = toReturnInfo(
      order({
        fulfillments: [{ ...DELIVERED, deliveredAt: '2026-09-01T12:00:00.000Z' }],
      }),
      30,
      NOW,
    )

    expect(info.eligible).toBe(false)
    expect(info.blocked).toBe(returnExpiredMessage(30))
    expect(info.window).toMatchObject({ last_day: '2026-10-01', days: 30 })
  })

  it('the last day itself still counts', () => {
    // Delivered 2026-09-20: 30 days later is 2026-10-20 (Warsaw), today.
    const info = toReturnInfo(
      order({ fulfillments: [{ ...DELIVERED, deliveredAt: '2026-09-20T12:00:00.000Z' }] }),
      30,
      NOW,
    )

    expect(info).toMatchObject({ eligible: true, window: { last_day: '2026-10-20' } })
  })

  it('every piece already requested or received: nothing left', () => {
    const info = toReturnInfo(
      order({
        items: [
          item('item_pump', 'Pompka elektryczna', { requested: 1, received: 1 }),
          item('item_leash', 'Leash spiralny', { shipped: 1, quantity: 1, dismissed: 1 }),
        ],
      }),
      30,
      NOW,
    )

    expect(info).toMatchObject({
      eligible: false,
      blocked: RETURN_MESSAGES.nothingLeft,
      items: [],
    })
  })

  it('returns: newest first, the admin draft (open) left out', () => {
    const info = toReturnInfo(
      order({
        returns: [
          returnRow({ id: 'ret_old', displayId: 1, requestedAt: new Date('2026-10-18T10:00:00Z') }),
          returnRow({ id: 'ret_draft', displayId: 2, status: 'open', requestedAt: null }),
          returnRow({ id: 'ret_new', displayId: 3, requestedAt: new Date('2026-10-19T10:00:00Z') }),
          returnRow({
            id: 'ret_canceled',
            displayId: 4,
            status: 'canceled',
            requestedAt: new Date('2026-10-17T10:00:00Z'),
          }),
        ],
      }),
      30,
      NOW,
    )

    expect(info.returns.map((entry) => [entry.id, entry.status])).toEqual([
      ['ret_new', 'requested'],
      ['ret_old', 'requested'],
      ['ret_canceled', 'canceled'],
    ])
  })
})

describe('toAccountReturn', () => {
  const base = order({
    items: [
      item('item_pump', 'Pompka elektryczna'),
      item('item_leash', 'Leash spiralny', {}, "10'"),
    ],
  })

  it('the lines with the title and variant of the order item and the reason code', () => {
    const entry = toAccountReturn(
      returnRow({
        items: [
          {
            itemId: 'item_leash',
            quantity: 2,
            receivedQuantity: 0,
            reason: 'defect',
            note: 'pęknięty',
          },
          { itemId: 'item_pump', quantity: 1, receivedQuantity: 0, reason: null, note: null },
        ],
      }),
      base,
    )

    expect(entry).toEqual({
      id: 'ret_1',
      display_id: 1,
      status: 'requested',
      requested_at: '2026-10-19T15:00:00.000Z',
      items: [
        {
          item_id: 'item_leash',
          title: 'Leash spiralny',
          variant: "10'",
          quantity: 2,
          reason: 'defect',
        },
        {
          item_id: 'item_pump',
          title: 'Pompka elektryczna',
          variant: null,
          quantity: 1,
          reason: null,
        },
      ],
    })
  })

  it('a reason that is not one of the shop codes shows as no reason', () => {
    const entry = toAccountReturn(
      returnRow({
        items: [
          {
            itemId: 'item_pump',
            quantity: 1,
            receivedQuantity: 0,
            reason: 'wrong_size',
            note: null,
          },
        ],
      }),
      base,
    )

    expect(entry?.items[0]?.reason).toBeNull()
  })

  it('the admin draft (open) is not a return the customer sees', () => {
    expect(toAccountReturn(returnRow({ status: 'open' }), base)).toBeNull()
  })

  it('a return without the request date shows null', () => {
    expect(toAccountReturn(returnRow({ requestedAt: null }), base)?.requested_at).toBeNull()
  })
})

describe('quantitiesOf', () => {
  it('reads the Medusa detail numbers, a missing one as 0', () => {
    expect(
      quantitiesOf({
        quantity: 3,
        shipped_quantity: '2',
        return_requested_quantity: 1,
      }),
    ).toEqual({ quantity: 3, shipped: 2, requested: 1, received: 0, dismissed: 0 })
  })

  it('no detail at all: nothing was shipped', () => {
    expect(quantitiesOf(undefined)).toEqual({
      quantity: 0,
      shipped: 0,
      requested: 0,
      received: 0,
      dismissed: 0,
    })
  })
})

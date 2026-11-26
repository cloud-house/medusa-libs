import { paidTotal, returnedShare, type SaleRow, saleAmounts, saleTotal } from '../sale-amounts'

/**
 * Rows as Medusa 2.21.2 returns them (`decorateCartTotals`): an order's and a line's `total`,
 * `original_total` and `tax_total` are those of the pieces NOT yet received back or dismissed; the
 * returned share of the gross amount is in `return_received_total` / `return_dismissed_total`.
 * Prices are gross (VAT 23% included), zł.
 */
const vat = (rate = 23) => [{ rate }]

/** 299 zł pump, 1 piece. */
const pump = (over: SaleRow = {}): SaleRow => ({
  id: 'item_pump',
  quantity: 1,
  unit_price: 299,
  is_tax_inclusive: true,
  tax_lines: vat(),
  total: 299,
  original_total: 299,
  ...over,
})

/** 89 zł leash, 2 pieces. */
const leash = (over: SaleRow = {}): SaleRow => ({
  id: 'item_leash',
  quantity: 2,
  unit_price: 89,
  is_tax_inclusive: true,
  tax_lines: vat(),
  total: 178,
  original_total: 178,
  ...over,
})

/** The order as Medusa returns it for the given lines; shipping 16,99 zł with its own VAT. */
function order(items: SaleRow[], over: SaleRow = {}): SaleRow {
  const itemTotal = items.reduce((sum, item) => sum + Number(item.total), 0)
  const originalItemTotal = items.reduce((sum, item) => sum + Number(item.original_total), 0)
  const itemsTax = items.reduce((sum, item) => sum + (Number(item.total) * 23) / 123, 0)
  return {
    item_total: itemTotal,
    original_item_total: originalItemTotal,
    shipping_total: 16.99,
    tax_total: itemsTax + (16.99 * 23) / 123,
    total: itemTotal + 16.99,
    items,
    ...over,
  }
}

const VAT_OF_ALL = (493.99 * 23) / 123

describe('returnedShare / saleTotal', () => {
  it('nothing returned: the total as it is', () => {
    expect(returnedShare({ total: 299 })).toBe(0)
    expect(saleTotal({ total: 299.5 })).toBe(299.5)
  })

  it('received and dismissed shares are added back', () => {
    const row = { total: 16.99, return_received_total: 299, return_dismissed_total: 89 }

    expect(returnedShare(row)).toBe(388)
    expect(saleTotal(row)).toBeCloseTo(404.99, 10)
  })

  it('string and missing amounts count as numbers', () => {
    expect(saleTotal({ total: '10.5', return_received_total: '4.5' })).toBe(15)
    expect(saleTotal({})).toBe(0)
  })

  it('refunds booked as credit lines are added back too', () => {
    // Everything received back, then the delivery refunded: Medusa's total is 16,99 − 16,99.
    expect(
      saleTotal({ total: 0, return_received_total: 477, credit_line_total: 16.99 }),
    ).toBeCloseTo(493.99, 10)
    expect(saleTotal({ total: '10.5', credit_line_total: '4.5' })).toBe(15)
  })
})

describe('paidTotal', () => {
  it('nothing returned: Medusa total untouched, noise included', () => {
    expect(paidTotal({ total: 59.087560975609755 })).toBe(59.087560975609755)
    expect(paidTotal({ total: 16.99, return_received_total: 0 })).toBe(16.99)
  })

  it('returned pieces: the sale total rounded to the grosz', () => {
    expect(paidTotal({ total: 16.99, return_received_total: 477 })).toBe(493.99)
    expect(
      paidTotal({
        total: 315.99,
        return_received_total: 88.99999999999999,
        return_dismissed_total: 89,
      }),
    ).toBe(493.99)
  })
})

describe('paidTotal – credit lines', () => {
  it('a refund above what Medusa counts as owed lowers the total – the paid amount is back', () => {
    expect(paidTotal({ total: 0, return_received_total: 477, credit_line_total: 16.99 })).toBe(
      493.99,
    )
  })

  it('a refund before any return (nothing received back) is added back as well', () => {
    expect(paidTotal({ total: 0, credit_line_total: 493.99 })).toBe(493.99)
  })

  it('no credit lines: the total untouched, noise included', () => {
    expect(paidTotal({ total: 59.087560975609755, credit_line_total: 0 })).toBe(59.087560975609755)
  })
})

describe('saleAmounts – nothing returned', () => {
  it('every figure stays exactly as Medusa has it, noise included', () => {
    const items = [pump(), leash({ total: 177.99999999999997 })]
    const placed = order(items, { tax_total: 92.37398373983739 })

    expect(saleAmounts(placed)).toEqual({
      lines: [
        { total: 299, original_total: 299 },
        { total: 177.99999999999997, original_total: 178 },
      ],
      item_total: placed.item_total,
      original_item_total: 477,
      tax_total: 92.37398373983739,
      total: placed.total,
    })
  })

  it('a requested but not received return changes nothing (Medusa counts only received pieces)', () => {
    const items = [pump({ return_received_total: 0, return_dismissed_total: 0 }), leash()]
    const placed = order(items)

    expect(saleAmounts(placed).total).toBe(placed.total)
    expect(saleAmounts(placed).lines[0]).toEqual({ total: 299, original_total: 299 })
  })

  it('an order without lines', () => {
    expect(
      saleAmounts({ total: 16.99, tax_total: 3.18, item_total: 0, original_item_total: 0 }),
    ).toEqual({ lines: [], item_total: 0, original_item_total: 0, tax_total: 3.18, total: 16.99 })
  })
})

describe('saleAmounts – returned pieces are put back', () => {
  it('a full return: the line, the items, VAT and the total are those of the sale', () => {
    const received = [
      pump({ total: 0, original_total: 0, return_received_total: 299 }),
      leash({ total: 0, original_total: 0, return_received_total: 178 }),
    ]
    // Medusa: only the delivery is left – 16,99 zł and its 3,18 zł VAT.
    const returned = order(received, { tax_total: (16.99 * 23) / 123, total: 16.99 })

    const sold = saleAmounts(returned)

    expect(sold.lines).toEqual([
      { total: 299, original_total: 299 },
      { total: 178, original_total: 178 },
    ])
    expect(sold.item_total).toBe(477)
    expect(sold.original_item_total).toBe(477)
    expect(sold.total).toBe(493.99)
    expect(sold.tax_total).toBeCloseTo(VAT_OF_ALL, 2)
    expect(sold.tax_total).toBe(Math.round(VAT_OF_ALL * 100) / 100)
  })

  it('a full return and a refund booked as a credit line: the total is the sale, the lines are not touched', () => {
    const received = [
      pump({ total: 0, original_total: 0, return_received_total: 299 }),
      leash({ total: 0, original_total: 0, return_received_total: 178 }),
    ]
    // Medusa: the delivery refund (16,99 zł) is a credit line, so `total` is 16,99 − 16,99 = 0.
    // Credit lines carry no tax lines: `tax_total` stays the delivery's VAT.
    const refunded = order(received, {
      tax_total: (16.99 * 23) / 123,
      total: 0,
      credit_line_total: 16.99,
    })

    const sold = saleAmounts(refunded)

    expect(sold.total).toBe(493.99)
    expect(sold.item_total).toBe(477)
    expect(sold.tax_total).toBe(Math.round(VAT_OF_ALL * 100) / 100)
    expect(sold.lines).toEqual([
      { total: 299, original_total: 299 },
      { total: 178, original_total: 178 },
    ])
  })

  it('a refund booked as a credit line with nothing received back: the total is the sale', () => {
    const placed = order([pump(), leash()], { total: 0, credit_line_total: 493.99 })

    const sold = saleAmounts(placed)

    expect(sold.total).toBe(493.99)
    expect(sold.item_total).toBe(477)
    expect(sold.lines).toEqual([
      { total: 299, original_total: 299 },
      { total: 178, original_total: 178 },
    ])
  })

  it('a partial return: one of two pieces of a line, the rest of the order untouched', () => {
    const received = [pump(), leash({ total: 89, original_total: 89, return_received_total: 89 })]
    const returned = order(received, {
      total: 299 + 89 + 16.99,
      tax_total: ((299 + 89 + 16.99) * 23) / 123,
    })

    const sold = saleAmounts(returned)

    expect(sold.lines).toEqual([
      { total: 299, original_total: 299 },
      { total: 178, original_total: 178 },
    ])
    expect(sold.item_total).toBe(477)
    expect(sold.original_item_total).toBe(477)
    expect(sold.total).toBe(493.99)
    expect(sold.tax_total).toBeCloseTo(VAT_OF_ALL, 2)
  })

  it('dismissed pieces are put back like the received ones', () => {
    const received = [
      pump({ total: 0, original_total: 0, return_dismissed_total: 299 }),
      leash({ total: 0, original_total: 0, return_received_total: 89, return_dismissed_total: 89 }),
    ]
    const returned = order(received, { tax_total: (16.99 * 23) / 123, total: 16.99 })

    const sold = saleAmounts(returned)

    expect(sold.total).toBe(493.99)
    expect(sold.item_total).toBe(477)
    expect(sold.lines).toEqual([
      { total: 299, original_total: 299 },
      { total: 178, original_total: 178 },
    ])
    expect(sold.tax_total).toBeCloseTo(VAT_OF_ALL, 2)
  })

  it('a discounted line: the total is the discounted sale, the original is the list price', () => {
    // 2 × 100 zł with 10% off = 180 zł; one piece (90 zł) received back.
    const discounted = {
      id: 'item_d',
      quantity: 2,
      unit_price: 100,
      is_tax_inclusive: true,
      tax_lines: vat(),
      total: 90,
      original_total: 100,
      return_received_total: 90,
    }
    const returned = {
      item_total: 90,
      original_item_total: 100,
      tax_total: (90 * 23) / 123,
      total: 90,
      items: [discounted],
    }

    const sold = saleAmounts(returned)

    expect(sold.lines).toEqual([{ total: 180, original_total: 200 }])
    expect(sold.item_total).toBe(180)
    expect(sold.original_item_total).toBe(200)
    expect(sold.total).toBe(180)
    expect(sold.tax_total).toBe(33.66)
  })

  it('prices without tax: the original total of a returned piece includes VAT', () => {
    const net = {
      id: 'item_n',
      quantity: 1,
      unit_price: 100,
      is_tax_inclusive: false,
      tax_lines: vat(),
      total: 0,
      original_total: 0,
      return_received_total: 123,
    }

    const sold = saleAmounts({
      item_total: 0,
      original_item_total: 0,
      tax_total: 0,
      total: 0,
      items: [net],
    })

    expect(sold.lines).toEqual([{ total: 123, original_total: 123 }])
    expect(sold.original_item_total).toBe(123)
    expect(sold.tax_total).toBe(23)
  })

  it('a returned line without a tax line adds no VAT; lines with other rates use their own', () => {
    const exempt = {
      id: 'item_e',
      quantity: 1,
      unit_price: 50,
      is_tax_inclusive: true,
      tax_lines: [],
      total: 0,
      original_total: 0,
      return_received_total: 50,
    }
    const reduced = {
      id: 'item_r',
      quantity: 1,
      unit_price: 108,
      is_tax_inclusive: true,
      tax_lines: vat(8),
      total: 0,
      original_total: 0,
      return_received_total: 108,
    }

    const sold = saleAmounts({
      item_total: 0,
      original_item_total: 0,
      tax_total: 0,
      total: 0,
      items: [exempt, reduced],
    })

    expect(sold.tax_total).toBe(8)
    expect(sold.total).toBe(158)
  })

  it('a line that is still there in full next to a returned one keeps its figures', () => {
    const rows = [pump({ total: 0, original_total: 0, return_received_total: 299 }), leash()]
    const returned = order(rows, {
      total: 178 + 16.99,
      tax_total: ((178 + 16.99) * 23) / 123,
    })

    const sold = saleAmounts(returned)

    expect(sold.lines[1]).toEqual({ total: 178, original_total: 178 })
    expect(sold.total).toBe(493.99)
  })
})

import type { InvoiceOrder } from '../../types'
import {
  CORRECTION_REASON,
  type CorrectionInput,
  correctionTotalCents,
  paidFor,
  toCorrectionPayload,
  wholeOrderReturned,
} from '../correction-mapping'
import { InvoiceMappingError, warsawDate } from '../mapping'

const CONFIG = { oidPrefix: 'INV-', departmentId: null }
const TODAY = new Date('2026-11-06T23:30:00Z')

const PUMP = {
  id: 'item_1',
  name: 'Pompka elektryczna 12 V',
  sku: 'PUMP-12V',
  quantity: 1,
  unitPriceCents: 29900,
  totalCents: 29900,
  taxRate: 23,
}

function order(over: Partial<InvoiceOrder> = {}): InvoiceOrder {
  return {
    id: 'order_1',
    displayId: 1001,
    email: 'jan@example.pl',
    totalCents: 31599,
    createdAt: new Date('2026-11-01T09:00:00Z'),
    nip: null,
    billing: {
      firstName: 'Jan',
      lastName: 'Kowalski',
      company: null,
      address1: 'Morska 1',
      address2: null,
      postalCode: '80-001',
      city: 'Gdańsk',
    },
    items: [PUMP],
    shipping: { name: 'Kurier DPD', totalCents: 1699, taxRate: 23 },
    paid: true,
    paidAt: new Date('2026-11-01T09:01:00Z'),
    providerId: 'pp_stripe_stripe',
    canceled: false,
    hasAccount: false,
    shopOrder: true,
    ...over,
  }
}

function input(over: Partial<CorrectionInput> = {}): CorrectionInput {
  return {
    order: order(),
    invoiceFakturowniaId: '1001',
    returnDisplayId: 3,
    returned: [{ itemId: 'item_1', quantity: 1 }],
    corrected: [],
    shipping: true,
    ...over,
  }
}

function mappingError(run: () => unknown): InvoiceMappingError {
  try {
    run()
  } catch (error) {
    if (error instanceof InvoiceMappingError) return error
    throw error
  }
  throw new Error('expected an InvoiceMappingError')
}

describe('toCorrectionPayload', () => {
  it('corrects a fully returned order to zero, delivery included', () => {
    const payload = toCorrectionPayload(input(), CONFIG, TODAY)

    expect(payload.positions).toEqual([
      {
        name: 'Pompka elektryczna 12 V',
        quantity: -1,
        total_price_gross: '-299.00',
        tax: '23',
        kind: 'correction',
        correction_before_attributes: {
          name: 'Pompka elektryczna 12 V',
          quantity: '1',
          total_price_gross: '299.00',
          tax: '23',
          kind: 'correction_before',
        },
        correction_after_attributes: {
          name: 'Pompka elektryczna 12 V',
          quantity: '0',
          total_price_gross: '0.00',
          tax: '23',
          kind: 'correction_after',
        },
      },
      {
        name: 'Dostawa – Kurier DPD',
        quantity: -1,
        total_price_gross: '-16.99',
        tax: '23',
        kind: 'correction',
        correction_before_attributes: {
          name: 'Dostawa – Kurier DPD',
          quantity: '1',
          total_price_gross: '16.99',
          tax: '23',
          kind: 'correction_before',
        },
        correction_after_attributes: {
          name: 'Dostawa – Kurier DPD',
          quantity: '0',
          total_price_gross: '0.00',
          tax: '23',
          kind: 'correction_after',
        },
      },
    ])
    expect(correctionTotalCents(payload)).toBe(-31599)
  })

  it('splits a discounted line by what was paid; two corrections add up to the line total', () => {
    const line = {
      id: 'item_2',
      name: 'Płetwa',
      sku: null,
      quantity: 2,
      unitPriceCents: 3333,
      totalCents: 6665,
      taxRate: 23,
    }
    const discounted = order({ items: [line], totalCents: 6665 + 1699 })

    const first = toCorrectionPayload(
      input({
        order: discounted,
        returned: [{ itemId: 'item_2', quantity: 1 }],
        shipping: false,
      }),
      CONFIG,
      TODAY,
    )
    const second = toCorrectionPayload(
      input({
        order: discounted,
        returnDisplayId: 4,
        returned: [{ itemId: 'item_2', quantity: 1 }],
        corrected: [{ itemId: 'item_2', quantity: 1 }],
        shipping: false,
      }),
      CONFIG,
      TODAY,
    )

    expect(first.positions[0]).toMatchObject({
      quantity: -1,
      total_price_gross: '-33.32',
      correction_before_attributes: { quantity: '2', total_price_gross: '66.65' },
      correction_after_attributes: { quantity: '1', total_price_gross: '33.33' },
    })
    expect(second.positions[0]).toMatchObject({
      quantity: -1,
      total_price_gross: '-33.33',
      correction_before_attributes: { quantity: '1', total_price_gross: '33.33' },
      correction_after_attributes: { quantity: '0', total_price_gross: '0.00' },
    })
    expect(correctionTotalCents(first) + correctionTotalCents(second)).toBe(-6665)
  })

  it('points at the invoice and carries the shop oid, the reason and the buyer', () => {
    const payload = toCorrectionPayload(input(), CONFIG, TODAY)

    expect(payload).toMatchObject({
      kind: 'correction',
      invoice_id: '1001',
      from_invoice_id: '1001',
      correction_reason: CORRECTION_REASON,
      oid: 'INV-1001-Z3',
      oid_unique: 'yes',
      issue_date: warsawDate(TODAY),
      currency: 'PLN',
      lang: 'pl',
      buyer_company: '0',
      buyer_name: 'Jan Kowalski',
      buyer_first_name: 'Jan',
      buyer_last_name: 'Kowalski',
      buyer_street: 'Morska 1',
      buyer_post_code: '80-001',
      buyer_city: 'Gdańsk',
      buyer_email: 'jan@example.pl',
      buyer_country: 'PL',
    })
    expect(CORRECTION_REASON).toBe('Zwrot towaru – odstąpienie od umowy')
    // 23:30 UTC is already the next day in Warsaw.
    expect(payload.issue_date).toBe('2026-11-07')
    expect(payload).not.toHaveProperty('department_id')
  })

  it('takes the department when one is set and names a company by its NIP', () => {
    const company = order({
      nip: '5260250274',
      billing: { ...order().billing, company: 'Wodne Sporty sp. z o.o.' },
    })

    const payload = toCorrectionPayload(
      input({ order: company }),
      { oidPrefix: 'INV-', departmentId: '42' },
      TODAY,
    )

    expect(payload.department_id).toBe('42')
    expect(payload).toMatchObject({
      buyer_company: '1',
      buyer_name: 'Wodne Sporty sp. z o.o.',
      buyer_tax_no: '5260250274',
    })
  })

  it('leaves the delivery out when not asked for or when it was free', () => {
    const without = toCorrectionPayload(input({ shipping: false }), CONFIG, TODAY)
    const free = toCorrectionPayload(
      input({ order: order({ shipping: { name: 'Kurier DPD', totalCents: 0, taxRate: 23 } }) }),
      CONFIG,
      TODAY,
    )

    expect(without.positions.map((position) => position.name)).toEqual(['Pompka elektryczna 12 V'])
    expect(free.positions).toHaveLength(1)
    expect(correctionTotalCents(without)).toBe(-29900)
  })

  it('cuts a long name like the invoice does', () => {
    const long = order({ items: [{ ...PUMP, name: 'x'.repeat(300) }] })

    const [position] = toCorrectionPayload(input({ order: long }), CONFIG, TODAY).positions

    expect(position?.name).toHaveLength(256)
    expect(position?.correction_before_attributes.name).toHaveLength(256)
  })

  it('refuses an item of another order, more pieces than left and a missing VAT rate', () => {
    expect(
      mappingError(() =>
        toCorrectionPayload(
          input({ returned: [{ itemId: 'item_9', quantity: 1 }] }),
          CONFIG,
          TODAY,
        ),
      ).message,
    ).toBe('Pozycja zwrotu item_9 nie należy do zamówienia.')
    expect(
      mappingError(() =>
        toCorrectionPayload(
          input({ returned: [{ itemId: 'item_1', quantity: 2 }] }),
          CONFIG,
          TODAY,
        ),
      ).message,
    ).toBe('Zwrot obejmuje więcej sztuk „Pompka elektryczna 12 V” niż zostało na fakturze.')
    expect(
      mappingError(() =>
        toCorrectionPayload(
          input({ corrected: [{ itemId: 'item_1', quantity: 1 }] }),
          CONFIG,
          TODAY,
        ),
      ).message,
    ).toBe('Zwrot obejmuje więcej sztuk „Pompka elektryczna 12 V” niż zostało na fakturze.')
    expect(
      mappingError(() =>
        toCorrectionPayload(
          input({ order: order({ items: [{ ...PUMP, taxRate: null }] }) }),
          CONFIG,
          TODAY,
        ),
      ).message,
    ).toBe('Pozycja „Pompka elektryczna 12 V” nie ma stawki VAT.')
  })
})

describe('paidFor', () => {
  it('is the paid share of a line, rounded to the grosz', () => {
    expect(paidFor(6665, 2, 2)).toBe(6665)
    expect(paidFor(6665, 2, 1)).toBe(3333)
    expect(paidFor(6665, 2, 0)).toBe(0)
    expect(paidFor(10000, 3, 1)).toBe(3333)
  })
})

describe('wholeOrderReturned', () => {
  it('is true once every piece came back, damaged pieces included', () => {
    expect(
      wholeOrderReturned([
        { quantity: 1, received: 1, dismissed: 0 },
        { quantity: 2, received: 2, dismissed: 0 },
      ]),
    ).toBe(true)
    expect(
      wholeOrderReturned([
        { quantity: 1, received: 1, dismissed: 0 },
        { quantity: 2, received: 1, dismissed: 0 },
      ]),
    ).toBe(false)
    expect(wholeOrderReturned([{ quantity: 2, received: 1, dismissed: 1 }])).toBe(true)
  })
})

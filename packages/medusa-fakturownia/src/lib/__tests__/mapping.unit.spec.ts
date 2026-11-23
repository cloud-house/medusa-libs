import type { InvoiceOrder } from '../../types'
import {
  buyerFields,
  buyerKind,
  InvoiceMappingError,
  payloadTotalCents,
  paymentType,
  toCents,
  toInvoicePayload,
  warsawDate,
} from '../mapping'

const CONFIG = { oidPrefix: 'INV-', departmentId: null }
const TYPES = {
  pp_stripe_stripe: 'card',
  'pp_stripe-blik_stripe': 'BLIK',
  'pp_stripe-przelewy24_stripe': 'Przelewy24',
}
const TODAY = new Date('2026-11-02T10:00:00Z')

function order(over: Partial<InvoiceOrder> = {}): InvoiceOrder {
  return {
    id: 'order_1',
    displayId: 1001,
    email: 'jan@example.pl',
    totalCents: 12345,
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
    items: [
      {
        id: 'item_1',
        name: 'Smycz spiralna 10',
        sku: 'LEASH-10',
        quantity: 1,
        unitPriceCents: 12345,
        totalCents: 12345,
        taxRate: 23,
      },
    ],
    shipping: { name: 'Kurier DPD', totalCents: 0, taxRate: 23 },
    paid: true,
    paidAt: new Date('2026-11-01T09:01:00Z'),
    providerId: 'pp_stripe_stripe',
    canceled: false,
    hasAccount: false,
    shopOrder: true,
    ...over,
  }
}

const positions = (payload: ReturnType<typeof toInvoicePayload>) => payload.positions

describe('toInvoicePayload', () => {
  it('builds a paid VAT invoice in PLN with the prefixed order number', () => {
    const payload = toInvoicePayload(order(), CONFIG, TODAY, TYPES)
    expect(payload).toMatchObject({
      kind: 'vat',
      currency: 'PLN',
      lang: 'pl',
      oid: 'INV-1001',
      oid_unique: 'yes',
      status: 'paid',
      paid: '123.45',
      issue_date: '2026-11-02',
      sell_date: '2026-11-01',
      paid_date: '2026-11-01',
      payment_to: '2026-11-01',
      payment_type: 'card',
      show_discount: '1',
      discount_kind: 'amount',
      buyer_email: 'jan@example.pl',
      buyer_country: 'PL',
    })
    expect(payload).not.toHaveProperty('department_id')
    expect(payload).not.toHaveProperty('buyer_phone')
  })

  it('takes the department when one is set', () => {
    const payload = toInvoicePayload(order(), { oidPrefix: 'INV-', departmentId: '42' }, TODAY)
    expect(payload.department_id).toBe('42')
  })

  it('names a private buyer from the billing address', () => {
    const payload = toInvoicePayload(order(), CONFIG, TODAY)
    expect(payload).toMatchObject({
      buyer_company: '0',
      buyer_name: 'Jan Kowalski',
      buyer_first_name: 'Jan',
      buyer_last_name: 'Kowalski',
      buyer_street: 'Morska 1',
      buyer_post_code: '80-001',
      buyer_city: 'Gdańsk',
    })
    expect(payload).not.toHaveProperty('buyer_tax_no')
  })

  it('names a company buyer with its NIP', () => {
    const company = order({
      nip: '5260250274',
      billing: { ...order().billing, company: 'Wodne Sporty sp. z o.o.', address2: 'lok. 4' },
    })
    expect(buyerKind(company)).toBe('company')
    const payload = toInvoicePayload(company, CONFIG, TODAY)
    expect(payload).toMatchObject({
      buyer_company: '1',
      buyer_name: 'Wodne Sporty sp. z o.o.',
      buyer_tax_no: '5260250274',
      buyer_street: 'Morska 1 lok. 4',
    })
    expect(payload).not.toHaveProperty('buyer_first_name')
  })

  it('the buyer block is the one a credit note reuses', () => {
    const company = order({ nip: '5260250274' })
    for (const buyer of [order(), company]) {
      expect(toInvoicePayload(buyer, CONFIG, TODAY)).toMatchObject(buyerFields(buyer))
    }
    expect(Object.keys(buyerFields(order()))).toEqual([
      'buyer_company',
      'buyer_name',
      'buyer_first_name',
      'buyer_last_name',
      'buyer_street',
      'buyer_post_code',
      'buyer_city',
    ])
  })

  it('keeps the unit price and puts the line discount as an amount', () => {
    const payload = toInvoicePayload(
      order({
        totalCents: 94998,
        items: [
          {
            id: 'item_1',
            name: 'Aqua Marina Beast – 10\'6"',
            sku: 'BEAST-106',
            quantity: 2,
            unitPriceCents: 49999,
            totalCents: 94998,
            taxRate: 23,
          },
        ],
      }),
      CONFIG,
      TODAY,
    )
    expect(positions(payload)).toEqual([
      {
        name: 'Aqua Marina Beast – 10\'6"',
        code: 'BEAST-106',
        quantity: 2,
        quantity_unit: 'szt.',
        tax: 23,
        price_gross: '499.99',
        discount: '50.00',
      },
    ])
  })

  it('leaves out the discount field without a discount and the code without a SKU', () => {
    const [line] = positions(
      toInvoicePayload(
        order({ items: [{ ...order().items[0], sku: null } as InvoiceOrder['items'][number]] }),
        CONFIG,
        TODAY,
      ),
    )
    expect(line).not.toHaveProperty('discount')
    expect(line).not.toHaveProperty('code')
  })

  it('has no shipping position for free delivery', () => {
    expect(positions(toInvoicePayload(order(), CONFIG, TODAY))).toHaveLength(1)
  })

  it('adds paid delivery as its own position', () => {
    const payload = toInvoicePayload(
      order({ totalCents: 14344, shipping: { name: 'Kurier DPD', totalCents: 1999, taxRate: 23 } }),
      CONFIG,
      TODAY,
    )
    expect(positions(payload)[1]).toEqual({
      name: 'Dostawa – Kurier DPD',
      quantity: 1,
      quantity_unit: 'szt.',
      tax: 23,
      price_gross: '19.99',
    })
  })

  it('sums to the order total to the grosz', () => {
    const cases: Partial<InvoiceOrder>[] = [
      {},
      {
        totalCents: 2 * 49999 - 5000 + 3 * 3999 + 1999 + 899 - 100,
        items: [
          {
            id: 'item_1',
            name: 'Deska',
            sku: 'A',
            quantity: 2,
            unitPriceCents: 49999,
            totalCents: 94998,
            taxRate: 23,
          },
          {
            id: 'item_2',
            name: 'Wiosło',
            sku: 'B',
            quantity: 3,
            unitPriceCents: 3999,
            totalCents: 11997,
            taxRate: 23,
          },
          {
            id: 'item_3',
            name: 'Pompka',
            sku: 'C',
            quantity: 1,
            unitPriceCents: 1999,
            totalCents: 1999,
            taxRate: 23,
          },
        ],
        shipping: { name: 'Kurier', totalCents: 799, taxRate: 23 },
      },
      {
        totalCents: 6665,
        items: [
          {
            id: 'item_1',
            name: 'Linka',
            sku: 'D',
            quantity: 2,
            unitPriceCents: 3333,
            totalCents: 6665,
            taxRate: 23,
          },
        ],
      },
    ]
    for (const over of cases) {
      const current = order(over)
      expect(payloadTotalCents(toInvoicePayload(current, CONFIG, TODAY))).toBe(current.totalCents)
    }
  })

  it('cuts position names to 256 characters', () => {
    const long = 'x'.repeat(300)
    const [line] = positions(
      toInvoicePayload(order({ items: [{ ...order().items[0], name: long }] }), CONFIG, TODAY),
    )
    expect(line.name).toHaveLength(256)
  })

  it('refuses a position without a VAT rate', () => {
    expect(() =>
      toInvoicePayload(order({ items: [{ ...order().items[0], taxRate: null }] }), CONFIG, TODAY),
    ).toThrow(InvoiceMappingError)
    expect(() =>
      toInvoicePayload(order({ items: [{ ...order().items[0], taxRate: null }] }), CONFIG, TODAY),
    ).toThrow('Pozycja „Smycz spiralna 10” nie ma stawki VAT.')
  })

  it('dates the sale by the order when the payment date is unknown', () => {
    const payload = toInvoicePayload(order({ paidAt: null }), CONFIG, TODAY)
    expect(payload.sell_date).toBe('2026-11-01')
  })
})

describe('helpers', () => {
  it('maps payment providers to Fakturownia payment types', () => {
    expect(paymentType('pp_stripe_stripe', TYPES)).toBe('card')
    expect(paymentType('pp_stripe-blik_stripe', TYPES)).toBe('BLIK')
    expect(paymentType('pp_stripe-przelewy24_stripe', TYPES)).toBe('Przelewy24')
    expect(paymentType('pp_system_default', TYPES)).toBe('transfer')
    expect(paymentType(null, TYPES)).toBe('transfer')
    expect(paymentType('pp_stripe_stripe')).toBe('transfer')
  })

  it('dates in the Warsaw time zone', () => {
    expect(warsawDate(new Date('2026-10-31T23:30:00Z'))).toBe('2026-11-01')
    expect(warsawDate(new Date('2026-07-31T21:59:00Z'))).toBe('2026-07-31')
  })

  it('turns zł into grosze', () => {
    expect(toCents(19.99)).toBe(1999)
    expect(toCents('0.1')).toBe(10)
  })
})

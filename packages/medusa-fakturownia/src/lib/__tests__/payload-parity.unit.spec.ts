import type { InvoiceOrder } from '../../types'
import { type CorrectionInput, toCorrectionPayload } from '../correction-mapping'
import { payloadTotalCents, toInvoicePayload } from '../mapping'

/**
 * Parity with the shop's snapshots (kit step 4a): the payload sent to Fakturownia is the content of the invoice, so
 * it must not change by one byte when the code moves to `@cloud-house/medusa-fakturownia`.
 */
/** The payment provider ids of the shop the snapshots were recorded in, and what they become. */
const STRIPE_PROVIDER_IDS = {
  card: 'pp_stripe_stripe',
  blik: 'pp_stripe-blik_stripe',
  p24: 'pp_stripe-przelewy24_stripe',
}
const TYPES = {
  [STRIPE_PROVIDER_IDS.card]: 'card',
  [STRIPE_PROVIDER_IDS.blik]: 'BLIK',
  [STRIPE_PROVIDER_IDS.p24]: 'Przelewy24',
}
const CONFIG = { oidPrefix: 'CHNS-', departmentId: null }
const TODAY = new Date('2026-11-02T10:00:00Z')

const PUMP = {
  id: 'item_pump',
  name: 'Pompka elektryczna 12 V',
  sku: 'PUMP-12V',
  quantity: 1,
  unitPriceCents: 29900,
  totalCents: 29900,
  taxRate: 23,
}
const LEASH = {
  id: 'item_leash',
  name: 'Smycz spiralna 10',
  sku: 'LEASH-10',
  quantity: 2,
  unitPriceCents: 7900,
  totalCents: 14200, // a discount of 16.00 on the line
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
    providerId: STRIPE_PROVIDER_IDS.card,
    canceled: false,
    hasAccount: false,
    shopOrder: true,
    ...over,
  }
}

const COMPANY = {
  nip: '5252525252',
  billing: {
    firstName: 'Anna',
    lastName: 'Nowak',
    company: 'Sup Sp. z o.o.',
    address1: 'Długa 5',
    address2: 'lok. 2',
    postalCode: '00-001',
    city: 'Warszawa',
  },
}

const ORDERS: [string, InvoiceOrder][] = [
  ['person, card, delivery', order()],
  ['company, BLIK', order({ ...COMPANY, providerId: STRIPE_PROVIDER_IDS.blik })],
  [
    'person, P24, free delivery',
    order({
      totalCents: 29900,
      providerId: STRIPE_PROVIDER_IDS.p24,
      shipping: { name: 'Kurier DPD', totalCents: 0, taxRate: 23 },
    }),
  ],
  ['offline transfer, no delivery', order({ totalCents: 29900, providerId: null, shipping: null })],
  ['discounted line, two items', order({ items: [PUMP, LEASH], totalCents: 29900 + 14200 + 1699 })],
  [
    'paid pickup point delivery',
    order({
      totalCents: 30400,
      shipping: { name: 'Odbiór', totalCents: 500, taxRate: 23 },
    }),
  ],
]

describe('invoice payload parity', () => {
  it.each(ORDERS)('%s', (_name, input) => {
    const payload = toInvoicePayload(input, CONFIG, TODAY, TYPES)
    expect(payload).toMatchSnapshot()
    expect(payloadTotalCents(payload)).toBe(input.totalCents)
  })
})

const CORRECTIONS: [string, CorrectionInput][] = [
  [
    'partial return, no delivery',
    {
      order: order({ items: [PUMP, LEASH], totalCents: 29900 + 14200 + 1699 }),
      invoiceFakturowniaId: '1001',
      returnDisplayId: 3,
      returned: [{ itemId: 'item_leash', quantity: 1 }],
      corrected: [],
      shipping: false,
    },
  ],
  [
    'whole order back, delivery included',
    {
      order: order(),
      invoiceFakturowniaId: '1001',
      returnDisplayId: 4,
      returned: [{ itemId: 'item_pump', quantity: 1 }],
      corrected: [],
      shipping: true,
    },
  ],
  [
    'second note after an earlier one',
    {
      order: order({ items: [PUMP, LEASH], totalCents: 29900 + 14200 + 1699 }),
      invoiceFakturowniaId: '1002',
      returnDisplayId: 5,
      returned: [{ itemId: 'item_leash', quantity: 1 }],
      corrected: [{ itemId: 'item_leash', quantity: 1 }],
      shipping: false,
    },
  ],
]

describe('correction payload parity', () => {
  it.each(CORRECTIONS)('%s', (_name, input) => {
    expect(toCorrectionPayload(input, CONFIG, TODAY)).toMatchSnapshot()
  })
})

import {
  DELIVERY_REVIEW_NOTES,
  type LineDiscountParts,
  type OrderSummary,
  type OrderSummaryItem,
} from '@cloud-house/commerce-rules'
import { replyToFor } from '../../lib/order-email'
import { toOrderPlacedEmailData } from '../../lib/order-email-data'

const item = (over: Partial<OrderSummaryItem> & { id: string }): OrderSummaryItem => ({
  variant_id: null,
  title: 'Standard',
  product_title: null,
  product_handle: null,
  variant_title: null,
  thumbnail: null,
  quantity: 1,
  total: 0,
  original_total: 0,
  metadata: null,
  ...over,
})

const address = {
  first_name: 'Jan',
  last_name: 'Kowalski',
  company: null,
  address_1: 'ul. Morska 5',
  address_2: null,
  postal_code: '80-001',
  city: 'Gdańsk',
  country_code: 'pl',
  phone: '+48600100200',
}

function order(over: Partial<OrderSummary> = {}): OrderSummary {
  return {
    id: 'order_1',
    display_id: 1001,
    email: 'jan@example.pl',
    created_at: '2026-10-19T08:00:00.000Z',
    payment_status: 'captured',
    items: [
      item({
        id: 'oi_board',
        variant_id: 'var_board',
        product_title: 'Allround Wave',
        variant_title: `10'6" / Turkus`,
        thumbnail: 'http://cdn.test/wave.webp',
        total: 1899,
        original_total: 1899,
      }),
      item({
        id: 'oi_vest',
        variant_id: 'var_vest',
        product_title: 'Kamizelka',
        total: 199,
        original_total: 199,
      }),
      item({
        id: 'oi_paddle',
        variant_id: 'var_paddle',
        product_title: 'Wiosło Carbon Pro',
        variant_title: 'Standard',
        total: 449.4,
        original_total: 749,
        metadata: { upgrade_of: 'var_board', replaces: 'Wiosło alu 3-cz.' },
      }),
    ],
    item_total: 2547.4,
    original_item_total: 2847,
    shipping_total: 0,
    tax_total: 476.35,
    total: 2547.4,
    shipping_address: address,
    billing_address: address,
    shipping_method: { name: 'Kurier InPost', code: 'kurier-inpost', amount: 0, data: {} },
    metadata: {},
    codes: [],
    ...over,
  }
}

/** The shop's grouping: an upgrade (`metadata.upgrade_of` = variant of its board) goes under the board. */
function groupByUpgrade<
  T extends { id: string; variant_id: string | null; metadata?: Record<string, unknown> | null },
>(items: T[]) {
  const boards = new Map<string, { line: T; upgrades: T[] }>()
  for (const item of items) {
    if (!item.metadata?.upgrade_of && item.variant_id && !boards.has(item.variant_id)) {
      boards.set(item.variant_id, { line: item, upgrades: [] })
    }
  }
  const groups: { line: T; upgrades: T[] }[] = []
  for (const item of items) {
    const parent = item.metadata?.upgrade_of
    const board = typeof parent === 'string' ? boards.get(parent) : undefined
    if (board) board.upgrades.push(item)
    else
      groups.push(
        boards.get(item.variant_id ?? '')?.line.id === item.id
          ? (boards.get(item.variant_id ?? '') as { line: T; upgrades: T[] })
          : { line: item, upgrades: [] },
      )
  }
  return groups
}

const extras = (over: Partial<Parameters<typeof toOrderPlacedEmailData>[1]> = {}) => ({
  variantLabels: new Map([['var_board', `Turkus · 10'6"`]]),
  discountByItem: new Map<string, LineDiscountParts>(),
  deliveryNote: null,
  contact: {
    email: 'sklep@chonasupa.pl',
    phone: '+48 600 100 200',
    hours: null,
    seller: 'ChoNaSupa sp. z o.o., ul. Morska 5, 80-001 Gdańsk, NIP 5260250274',
    returnDays: null,
    returnAddress: null,
  },
  replyTo: 'sklep@chonasupa.pl',
  shopUrl: 'https://chonasupa.pl',
  lockerCode: 'paczkomat-inpost',
  reviewNotes: DELIVERY_REVIEW_NOTES,
  groupLines: groupByUpgrade,
  ...over,
})

describe('toOrderPlacedEmailData', () => {
  it('without groupLines every line stands on its own and keeps its replaces label', () => {
    const data = toOrderPlacedEmailData(order(), extras({ groupLines: undefined }))
    expect(data.groups.map((g) => [g.line.title, g.upgrades.length])).toEqual([
      ['Allround Wave', 0],
      ['Kamizelka', 0],
      ['Wiosło Carbon Pro', 0],
    ])
  })

  it('groups the upgrade under its board with the variant label and the bundle discount', () => {
    const data = toOrderPlacedEmailData(order(), extras())

    expect(data).toMatchObject({
      displayId: 1001,
      placedAt: '19 października 2026',
      firstName: 'Jan',
      totals: {
        products: 2847,
        discounts: 299.6,
        shipping: 0,
        shippingMethod: 'Kurier InPost',
        total: 2547.4,
        tax: 476.35,
      },
      invoice: null,
      shopUrl: 'https://chonasupa.pl',
    })
    expect(data.groups.map((g) => [g.line.title, g.upgrades.map((u) => u.title)])).toEqual([
      ['Allround Wave', ['Wiosło Carbon Pro']],
      ['Kamizelka', []],
    ])
    expect(data.groups[0]?.line).toMatchObject({
      variant: `Turkus · 10'6"`,
      thumbnail: 'http://cdn.test/wave.webp',
      discountLabel: null,
    })
    expect(data.groups[0]?.upgrades[0]).toMatchObject({
      variant: null,
      replaces: 'Wiosło alu 3-cz.',
      originalTotal: 749,
      discountLabel: 'Rabat zestawowy',
    })
  })

  it('an upgrade whose board is not in the order is not „zamiast” anything', () => {
    const base = order()
    const data = toOrderPlacedEmailData(
      order({ items: base.items.filter((i) => i.id !== 'oi_board') }),
      extras(),
    )

    expect(data.groups.map((g) => [g.line.title, g.line.replaces])).toEqual([
      ['Kamizelka', null],
      ['Wiosło Carbon Pro', null],
    ])
  })

  it('a code discount is named by its code', () => {
    const data = toOrderPlacedEmailData(
      order(),
      extras({
        discountByItem: new Map([['oi_paddle', { bundle: 0, code: 299.6, codes: ['WIOSNA10'] }]]),
      }),
    )

    expect(data.groups[0]?.upgrades[0]?.discountLabel).toBe('Kod WIOSNA10')
  })

  it('a line with the bundle discount and a code names both', () => {
    const data = toOrderPlacedEmailData(
      order(),
      extras({
        discountByItem: new Map([
          ['oi_paddle', { bundle: 254.66, code: 44.94, codes: ['LATO10'] }],
        ]),
      }),
    )

    expect(data.groups[0]?.upgrades[0]?.discountLabel).toBe('Rabat zestawowy + kod LATO10')
  })

  it('a courier shows the address and the phone', () => {
    expect(toOrderPlacedEmailData(order(), extras()).delivery).toEqual({
      method: 'Kurier InPost',
      lines: ['Jan Kowalski', 'ul. Morska 5', '80-001 Gdańsk', 'tel. +48 600 100 200'],
      note: null,
    })
  })

  it('a parcel locker shows the point and the courier note', () => {
    const data = toOrderPlacedEmailData(
      order({
        shipping_method: {
          name: 'Paczkomat InPost',
          code: 'paczkomat-inpost',
          amount: 12.99,
          data: { parcel_locker: 'KRA01M', parcel_locker_label: 'ul. Krakowska 1, 30-001 Kraków' },
        },
      }),
      extras({ deliveryNote: 'board_to_parcel_locker' }),
    )

    expect(data.delivery).toEqual({
      method: 'Paczkomat InPost',
      lines: ['Paczkomat KRA01M', 'ul. Krakowska 1, 30-001 Kraków'],
      note: 'Część zamówienia nie zmieści się w paczkomacie – wyślemy ją kurierem pod adres z zamówienia.',
    })
  })

  it('a bulky item in an InPost courier order says it goes by DPD instead', () => {
    const data = toOrderPlacedEmailData(
      order(),
      extras({ deliveryNote: 'bulky_with_inpost_courier' }),
    )

    expect(data.delivery?.note).toBe(
      'Produkt, który wysyłamy tylko kurierem DPD, pojedzie kurierem DPD zamiast Kuriera InPost.',
    )
    expect(data.delivery?.lines[0]).toBe('Jan Kowalski')
  })

  it('without a delivery review there is no note', () => {
    expect(toOrderPlacedEmailData(order(), extras()).delivery?.note).toBeNull()
  })

  it('the invoice has the company, the NIP and the billing address', () => {
    const data = toOrderPlacedEmailData(
      order({
        billing_address: { ...address, company: 'Sup Sp. z o.o.', address_1: 'ul. Biurowa 1' },
        metadata: { nip: '5260250274' },
      }),
      extras(),
    )

    expect(data.invoice).toEqual({
      company: 'Sup Sp. z o.o.',
      nip: '5260250274',
      lines: ['ul. Biurowa 1', '80-001 Gdańsk'],
    })
  })

  it('without a first name and without a Reply-To', () => {
    const data = toOrderPlacedEmailData(
      order({ shipping_address: { ...address, first_name: '  ' } }),
      extras({ replyTo: null, contact: null }),
    )

    expect(data.firstName).toBeNull()
    expect(data.contact).toEqual({ canReply: false, email: null, phone: null, hours: null })
    expect(data.seller).toBeNull()
  })

  it('customer note from the order metadata: trimmed, empty → null', () => {
    const note = (metadata: Record<string, unknown>) =>
      toOrderPlacedEmailData(order({ metadata }), extras()).customerNote

    expect(note({ customer_note: '  Proszę dzwonić\nprzed dostawą  ' })).toBe(
      'Proszę dzwonić\nprzed dostawą',
    )
    expect(note({ customer_note: '   ' })).toBeNull()
    expect(note({})).toBeNull()
  })

  it('passes the seller line from the shop contact', () => {
    expect(toOrderPlacedEmailData(order(), extras()).seller).toBe(
      'ChoNaSupa sp. z o.o., ul. Morska 5, 80-001 Gdańsk, NIP 5260250274',
    )
  })
})

describe('replyToFor', () => {
  const contact = {
    email: 'sklep@chonasupa.pl',
    phone: null,
    hours: null,
    seller: null,
    returnDays: null,
    returnAddress: null,
  }

  it('EMAIL_REPLY_TO wins, then the shop contact, then nothing', () => {
    expect(replyToFor({ EMAIL_REPLY_TO: 'obsluga@chonasupa.pl' }, contact)).toBe(
      'obsluga@chonasupa.pl',
    )
    expect(replyToFor({}, contact)).toBe('sklep@chonasupa.pl')
    expect(replyToFor({}, null)).toBeNull()
  })
})

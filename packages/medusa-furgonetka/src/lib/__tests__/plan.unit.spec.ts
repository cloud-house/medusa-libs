import type { ShipmentRow, TemplateRow } from '../../modules/furgonetka/service'
import type { ParcelSpec, ShipmentReceiver } from '../../types'
import type { ShippingOrder } from '../order'
import {
  keptPackage,
  orderBlocker,
  PAGE_BLOCKERS,
  planProblems,
  receiverFromOrder,
  type ShipmentPlan,
  shipmentPlan,
} from '../plan'
import { DEFAULT_TEMPLATES } from './default-templates'

const SETTINGS = {
  classes: [
    { key: 'board', label: 'Deska', carriers: ['dpd' as const] },
    { key: 'courier_only', label: 'Tylko kurier', carriers: ['dpd' as const] },
  ],
  codes: { inpostCourier: 'kurier-inpost', inpostLocker: 'paczkomat-inpost' },
}

const at = new Date('2026-11-03T10:00:00.000Z')

/** The seed templates as rows (ids and timestamps the way the database would give them). */
const templates: TemplateRow[] = DEFAULT_TEMPLATES.map((template, index) => ({
  ...template,
  id: `ptpl_${index}`,
  created_at: at,
  updated_at: at,
  deleted_at: null,
}))

const BOARD = {
  id: 'item_1',
  title: 'Deska SUP',
  quantity: 1,
  variant: null,
  productId: null,
  parcelClass: 'board' as const,
}
const PUMP = {
  id: 'item_2',
  title: 'Pompka',
  quantity: 2,
  variant: null,
  productId: null,
  parcelClass: null,
}

/** A paid shop order for the DPD courier with a board; `overrides` change what a test is about. */
const order = (overrides: Partial<ShippingOrder> = {}): ShippingOrder => ({
  id: 'order_1',
  displayId: 1001,
  createdAt: at,
  email: 'jan@example.com',
  customerName: 'Jan Kowalski',
  shopOrder: true,
  paid: true,
  canceled: false,
  hasAccount: false,
  deliveryCode: 'kurier-dpd',
  deliveryName: 'Kurier DPD',
  lockerCode: null,
  lockerLabel: null,
  address: {
    firstName: 'Jan',
    lastName: 'Kowalski',
    company: null,
    address1: 'ul. Morska 5',
    address2: null,
    postalCode: '80-001',
    city: 'Gdańsk',
    phone: '600 100 200',
  },
  items: [BOARD],
  itemsTotalCents: 249900,
  fulfillments: [],
  ...overrides,
})

const ADDRESS = order().address as NonNullable<ShippingOrder['address']>

/** An order for a parcel locker; the board is replaced with accessories unless `items` says more. */
const lockerOrder = (overrides: Partial<ShippingOrder> = {}) =>
  order({
    deliveryCode: 'paczkomat-inpost',
    deliveryName: 'Paczkomat InPost',
    lockerCode: 'KRA01M',
    lockerLabel: 'ul. Krakowska 1, 30-001 Kraków',
    items: [PUMP],
    ...overrides,
  })

const parcel: ParcelSpec = {
  template_id: 'ptpl_x',
  name: 'Mój karton',
  kind: 'box',
  length_cm: 50,
  width_cm: 40,
  height_cm: 30,
  weight_g: 7000,
}

const receiver: ShipmentReceiver = {
  name: 'Anna Nowak',
  company: null,
  phone: '+48501234567',
  email: 'anna@example.com',
  street: 'ul. Długa 12',
  postal_code: '31-147',
  city: 'Kraków',
  point: null,
  point_label: null,
}

/** A shipment row with only the columns the plan reads. */
const row = (columns: Partial<Record<keyof ShipmentRow, unknown>> = {}): ShipmentRow =>
  ({
    state: 'draft',
    carrier: 'dpd',
    receiver,
    parcels: [parcel],
    declared_value_cents: 123400,
    pickup: 'drop_off',
    ...columns,
  }) as unknown as ShipmentRow

const planOf = (value: ReturnType<typeof shipmentPlan>): ShipmentPlan => {
  if ('missing' in value) throw new Error(`template missing: ${value.missing}`)
  return value
}

const codes = (problems: ReturnType<typeof planProblems>) => problems.map((p) => p.code)

describe('receiverFromOrder', () => {
  it('takes the name, e-mail, company, address and the normalised phone from the order', () => {
    const result = receiverFromOrder(
      order({
        address: { ...ADDRESS, company: 'SUP Sp. z o.o.', phone: '600 100 200' },
      }),
    )

    expect(result).toEqual({
      name: 'Jan Kowalski',
      company: 'SUP Sp. z o.o.',
      phone: '+48600100200',
      email: 'jan@example.com',
      street: 'ul. Morska 5',
      postal_code: '80-001',
      city: 'Gdańsk',
      point: null,
      point_label: null,
    })
  })

  it('appends address_2 to the street', () => {
    const result = receiverFromOrder(
      order({ address: { ...ADDRESS, address1: 'ul. Morska 5', address2: 'm. 12' } }),
    )

    expect(result.street).toBe('ul. Morska 5 m. 12')
  })

  it('keeps the parcel locker with its description', () => {
    const result = receiverFromOrder(lockerOrder())

    expect(result.point).toBe('KRA01M')
    expect(result.point_label).toBe('ul. Krakowska 1, 30-001 Kraków')
  })

  it.each([
    ['600 100 200', '+48600100200'],
    ['+48 600-100-200', '+48600100200'],
    ['0048 (600) 100 200', '+48600100200'],
    ['600100200', '+48600100200'],
    ['  22 123  ', '22 123'],
    ['', ''],
    [null, ''],
  ])('writes the phone %j as %j', (phone, expected) => {
    const result = receiverFromOrder(order({ address: { ...ADDRESS, phone } }))

    expect(result.phone).toBe(expected)
  })

  it('has no street, code or city for an order without an address', () => {
    const result = receiverFromOrder(order({ address: null, customerName: 'Jan Kowalski' }))

    expect(result).toMatchObject({
      name: 'Jan Kowalski',
      phone: '',
      street: null,
      postal_code: null,
      city: null,
    })
  })
})

describe('shipmentPlan', () => {
  it('lets a draft win over the suggestion', () => {
    const result = planOf(shipmentPlan(order(), row(), templates, SETTINGS))

    expect(result).toEqual({
      carrier: 'dpd',
      receiver,
      parcels: [parcel],
      declaredValueCents: 123400,
      pickup: 'drop_off',
    })
  })

  it.each(['failed', 'creating'])('keeps the choices of a %s row', (state) => {
    const result = planOf(
      shipmentPlan(order(), row({ state, carrier: 'inpost_courier' }), templates, SETTINGS),
    )

    expect(result.carrier).toBe('inpost_courier')
    expect(result.parcels).toEqual([parcel])
  })

  it('suggests a board carton for a board by DPD, insured for the items total', () => {
    const result = planOf(shipmentPlan(order(), null, templates, SETTINGS))

    expect(result.carrier).toBe('dpd')
    expect(result.parcels.map((p) => p.name)).toEqual(['Karton deski'])
    expect(result.declaredValueCents).toBe(249900)
    expect(result.pickup).toBe('courier')
  })

  it('suggests the InPost courier for a Kurier InPost order', () => {
    const result = planOf(
      shipmentPlan(
        order({ deliveryCode: 'kurier-inpost', items: [PUMP] }),
        null,
        templates,
        SETTINGS,
      ),
    )

    expect(result.carrier).toBe('inpost_courier')
    expect(result.parcels.map((p) => p.name)).toEqual(['Karton mały'])
  })

  it('suggests one small parcel to the locker, with the point in the receiver', () => {
    const result = planOf(shipmentPlan(lockerOrder(), null, templates, SETTINGS))

    expect(result.carrier).toBe('inpost_locker')
    expect(result.parcels.map((p) => p.name)).toEqual(['Paczkomat A'])
    expect(result.receiver.point).toBe('KRA01M')
  })

  it('takes the receiver of the suggestion from the order', () => {
    const result = planOf(shipmentPlan(order(), null, templates, SETTINGS))

    expect(result.receiver).toEqual(receiverFromOrder(order()))
    expect(result.receiver.phone).toBe('+48600100200')
  })

  it('ignores a row that is already a shipment', () => {
    const result = planOf(
      shipmentPlan(
        order(),
        row({ state: 'ready', carrier: 'inpost_courier' }),
        templates,
        SETTINGS,
      ),
    )

    expect(result.carrier).toBe('dpd')
    expect(result.parcels.map((p) => p.name)).toEqual(['Karton deski'])
  })

  it('reports the purpose without a template', () => {
    const withoutBoard = templates.filter((template) => template.purpose !== 'board')

    expect(shipmentPlan(order(), null, withoutBoard, SETTINGS)).toEqual({ missing: 'board' })
  })

  it('does not need a template when the draft has its parcels', () => {
    const result = shipmentPlan(order(), row(), [], SETTINGS)

    expect('missing' in result).toBe(false)
  })
})

describe('planProblems', () => {
  const problems = (o: ShippingOrder, draft: ShipmentRow | null = null) =>
    planProblems(o, shipmentPlan(o, draft, templates, SETTINGS), SETTINGS)

  it('is empty for a board to a complete address by DPD', () => {
    expect(problems(order())).toEqual([])
  })

  it('blocks a board for the parcel locker, in Polish', () => {
    const o = order({
      deliveryCode: 'paczkomat-inpost',
      lockerCode: 'KRA01M',
      items: [BOARD],
    })

    expect(problems(o)).toEqual([
      {
        code: 'bulky_inpost',
        message:
          'Sprawdź dostawę: produkt wysyłany tylko kurierem DPD – zmień przewoźnika w karcie „Wysyłka”.',
      },
    ])
  })

  it('blocks a bulky item for the InPost courier', () => {
    const o = order({ deliveryCode: 'kurier-inpost' })

    expect(codes(problems(o))).toEqual(['bulky_inpost'])
  })

  it('lets a draft with carrier DPD solve it', () => {
    const o = order({
      deliveryCode: 'paczkomat-inpost',
      lockerCode: 'KRA01M',
      items: [BOARD],
    })

    expect(problems(o, row({ carrier: 'dpd' }))).toEqual([])
  })

  it('follows the items, not the delivery review flag', () => {
    const flagged = order({
      deliveryCode: 'kurier-inpost',
      items: [PUMP],
    })
    const unflagged = order({ deliveryCode: 'kurier-inpost' })

    expect(problems(flagged)).toEqual([])
    expect(codes(problems(unflagged))).toEqual(['bulky_inpost'])
  })

  it('blocks a draft that moves a board to the InPost courier', () => {
    const o = order()

    expect(codes(problems(o, row({ carrier: 'inpost_courier' })))).toEqual(['bulky_inpost'])
  })

  it('blocks a parcel locker without a code, and a draft with the point solves it', () => {
    const o = lockerOrder({ lockerCode: null, lockerLabel: null })

    expect(problems(o)).toEqual([
      { code: 'locker_code', message: 'Paczkomat bez kodu – wpisz kod w karcie „Wysyłka”.' },
    ])
    const draft = row({
      carrier: 'inpost_locker',
      receiver: { ...receiver, point: 'WAW22M', point_label: 'Warszawa' },
    })
    expect(problems(o, draft)).toEqual([])
  })

  it('blocks a landline at the parcel locker, and a draft with a mobile number solves it', () => {
    const o = lockerOrder({ address: { ...ADDRESS, phone: '+48221234567' } })

    expect(problems(o)).toEqual([
      {
        code: 'locker_phone',
        message: 'Numer stacjonarny przy paczkomacie – wpisz numer komórkowy w karcie „Wysyłka”.',
      },
    ])
    const draft = row({
      carrier: 'inpost_locker',
      receiver: { ...receiver, point: 'KRA01M', phone: '+48601234567' },
    })
    expect(problems(o, draft)).toEqual([])
  })

  it('asks for the code and the number together', () => {
    const o = lockerOrder({
      lockerCode: null,
      address: { ...ADDRESS, phone: '221234567' },
    })

    expect(codes(problems(o))).toEqual(['locker_code', 'locker_phone'])
  })

  it('blocks a courier without an address, and a draft with one solves it', () => {
    const o = order({ items: [PUMP], address: null })

    expect(problems(o)).toEqual([
      {
        code: 'address',
        message: 'Brak adresu dostawy – uzupełnij go w karcie „Wysyłka”.',
      },
    ])
    expect(problems(o, row())).toEqual([])
  })

  it.each([
    ['street', { address1: null }],
    ['postal code', { postalCode: null }],
    ['city', { city: ' ' }],
  ])('blocks a courier without the %s', (_name, change) => {
    const o = order({ items: [PUMP], address: { ...ADDRESS, ...change } })

    expect(codes(problems(o))).toEqual(['address'])
  })

  it('needs no address for the parcel locker', () => {
    const o = lockerOrder({ address: null })

    // The phone is the only thing the locker needs besides the code.
    expect(codes(problems(o))).toEqual(['locker_phone'])
  })

  it('needs the address once a draft moves the locker order to a courier', () => {
    const o = lockerOrder({ address: null })
    const draft = row({ carrier: 'dpd', receiver: { ...receiver, street: null } })

    expect(codes(problems(o, draft))).toEqual(['address'])
  })

  it('reports the missing template with its name', () => {
    const o = order()

    expect(planProblems(o, { missing: 'board' }, SETTINGS)).toEqual([
      {
        code: 'template',
        message: 'Brak szablonu paczki „Deska” – ustaw go w Settings → Wysyłka.',
      },
    ])
  })

  it.each([
    ['courier_only', 'Tylko kurier'],
    ['accessories_locker', 'Akcesoria – paczkomat'],
    ['accessories_courier', 'Akcesoria – kurier'],
  ] as const)('names the purpose %s in the template problem', (missing, label) => {
    const [problem] = planProblems(order(), { missing }, SETTINGS)

    expect(problem?.message).toBe(
      `Brak szablonu paczki „${label}” – ustaw go w Settings → Wysyłka.`,
    )
  })

  it('reports the other problems of the order next to the missing template', () => {
    const o = order({ address: null, items: [PUMP] })

    expect(codes(planProblems(o, { missing: 'accessories_courier' }, SETTINGS))).toEqual([
      'address',
      'template',
    ])
  })
})

describe('orderBlocker', () => {
  it('lets a paid order without a fulfillment or shipment through', () => {
    expect(orderBlocker(order(), null)).toBeNull()
    expect(orderBlocker(order(), row({ state: 'draft' }))).toBeNull()
    expect(orderBlocker(order(), row({ state: 'failed' }))).toBeNull()
  })

  it('refuses an unpaid order', () => {
    expect(orderBlocker(order({ paid: false }), null)).toBe('Zamówienie nie jest opłacone.')
  })

  it('refuses a canceled order', () => {
    expect(orderBlocker(order({ canceled: true }), null)).toBe('Zamówienie jest anulowane.')
  })

  it('refuses an order with a fulfillment that was not canceled', () => {
    const fulfillments = [
      { id: 'ful_1', canceledAt: at, shippedAt: null, deliveredAt: null },
      { id: 'ful_2', canceledAt: null, shippedAt: null, deliveredAt: null },
    ]

    expect(orderBlocker(order({ fulfillments }), null)).toBe('Zamówienie ma już realizację.')
  })

  it('does not count a canceled fulfillment', () => {
    const fulfillments = [{ id: 'ful_1', canceledAt: at, shippedAt: null, deliveredAt: null }]

    expect(orderBlocker(order({ fulfillments }), null)).toBeNull()
  })

  it.each(['ready', 'in_transit', 'delivered', 'problem'])(
    'refuses an order with a %s shipment',
    (state) => {
      expect(orderBlocker(order(), row({ state }))).toBe('Zamówienie ma już przesyłkę.')
    },
  )

  it('names the shipment, not the fulfillment it created', () => {
    const fulfillments = [{ id: 'ful_1', canceledAt: null, shippedAt: null, deliveredAt: null }]

    expect(orderBlocker(order({ fulfillments }), row({ state: 'ready' }))).toBe(
      'Zamówienie ma już przesyłkę.',
    )
  })

  it('names payment before cancellation before the fulfillment', () => {
    const fulfillments = [{ id: 'ful_1', canceledAt: null, shippedAt: null, deliveredAt: null }]

    expect(orderBlocker(order({ paid: false, canceled: true, fulfillments }), null)).toBe(
      'Zamówienie nie jest opłacone.',
    )
    expect(orderBlocker(order({ canceled: true, fulfillments }), null)).toBe(
      'Zamówienie jest anulowane.',
    )
  })
})

describe('keptPackage', () => {
  const NOT_CANCELED = 'Przesyłka w Furgonetce nie została anulowana – anuluj ją w Furgonetce'

  it('is the newest row when it is canceled and Furgonetka kept its package', () => {
    const kept = row({ state: 'canceled', cancel_error: NOT_CANCELED })

    expect(keptPackage(kept)).toBe(kept)
  })

  it('is nothing for a clean cancel, a row that is not canceled, or no row', () => {
    expect(keptPackage(row({ state: 'canceled', cancel_error: null }))).toBeNull()
    expect(keptPackage(row({ state: 'draft', cancel_error: null }))).toBeNull()
    expect(keptPackage(null)).toBeNull()
  })
})

describe('PAGE_BLOCKERS', () => {
  it('holds the texts of the page banner', () => {
    expect(PAGE_BLOCKERS).toEqual({
      not_configured: 'Furgonetka nie jest skonfigurowana – realizacja ręczna jak dotąd',
      not_connected: 'Furgonetka nie jest połączona – połącz konto w Settings → Wysyłka',
      disconnected: 'Połączenie z Furgonetką wygasło – połącz ponownie w Settings → Wysyłka',
      sender: 'Uzupełnij adres i telefon magazynu (Settings → Locations)',
    })
  })
})

describe('parcel classes in the plan (kit step 4c)', () => {
  const sofa = { key: 'sofa', label: 'Sofa', carriers: ['dpd' as const, 'inpost_courier' as const] }
  const settings = { ...SETTINGS, classes: [...SETTINGS.classes, sofa] }
  const sofaItem = {
    id: 'item_9',
    title: 'Sofa',
    variant: null,
    productId: null,
    quantity: 1,
    parcelClass: 'sofa',
  }
  const inpost = (items: ShippingOrder['items']) =>
    order({ deliveryCode: 'kurier-inpost', deliveryName: 'Kurier InPost', items })
  const sofaTemplate = { ...templates[0], id: 'ptpl_sofa', purpose: 'sofa' } as TemplateRow

  it('a class that lists the InPost courier does not block it', () => {
    const o = inpost([sofaItem])
    const plan = shipmentPlan(o, null, [sofaTemplate], settings)

    expect(planProblems(o, plan, settings)).toEqual([])
  })

  it('a class that lists only DPD blocks the InPost courier, also next to a class that allows it', () => {
    const o = inpost([sofaItem, { ...sofaItem, id: 'item_10', parcelClass: 'board' }])
    const plan = shipmentPlan(o, null, [sofaTemplate, ...templates], settings)

    expect(planProblems(o, plan, settings).map((problem) => problem.code)).toContain('bulky_inpost')
  })

  it('an item whose class is not declared is an ordinary item', () => {
    const o = order({ items: [{ ...sofaItem, parcelClass: 'bogus' }] })
    const plan = shipmentPlan(o, null, templates, SETTINGS)

    expect(planProblems(o, plan, SETTINGS)).toEqual([])
  })

  it('names the class in the problem of a missing template', () => {
    const o = order({ items: [sofaItem] })
    const plan = shipmentPlan(o, null, templates, settings)
    const found = planProblems(o, plan, settings).find((problem) => problem.code === 'template')

    expect(found?.message).toContain('Sofa')
  })
})

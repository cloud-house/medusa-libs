import type {
  AdminShipmentResponse,
  AdminShipmentView,
  CardTemplate,
} from '../../../lib/card-types'
import type { CreateResult, QueueRow } from '../../../lib/queue-types'
import type { ParcelSpec, ShipmentPlan } from '../../../types'
import {
  addParcel,
  batchToast,
  type CardForm,
  type ChosenTerm,
  cardToast,
  cardWarning,
  carrierSummary,
  centsFromZl,
  changeCarrier,
  deliveryLabel,
  draftOf,
  formOf,
  formParcelOf,
  historyLabel,
  orderDateText,
  ordersCount,
  parcelsLabel,
  pickupLine,
  pickupOf,
  queueStateLabel,
  resultLabel,
  shipmentStateLabel,
  templateParcel,
  templatesFor,
  termOf,
  termProblem,
  zlInput,
} from '../shipment-labels'

const WINDOW = { date: '2026-11-04', from: '10:00', to: '15:00' }

const state = (over: Partial<QueueRow> = {}) => ({
  state: 'new' as const,
  pickup: null,
  pickupStatus: null,
  pickupWindow: null,
  error: null,
  ...over,
})

const delivery = (over: Partial<QueueRow['delivery']> = {}): Pick<QueueRow, 'delivery'> => ({
  delivery: { carrier: 'dpd', lockerCode: null, changed: false, ...over },
})

const parcel = (name: string, weight_g: number, over: Partial<ParcelSpec> = {}): ParcelSpec => ({
  template_id: null,
  name,
  kind: 'box',
  length_cm: 95,
  width_cm: 45,
  height_cm: 30,
  weight_g,
  ...over,
})

const BOARD = parcel('Karton deski', 15000)
const SMALL = parcel('Karton mały', 3000, { length_cm: 40, width_cm: 30, height_cm: 20 })

describe('queueStateLabel', () => {
  it('calls an order without a shipment „nowe”', () => {
    expect(queueStateLabel(state())).toBe('nowe')
  })

  it('calls a shipment that is being created „w tworzeniu”', () => {
    expect(queueStateLabel(state({ state: 'creating' }))).toBe('w tworzeniu')
  })

  it('gives the reason of a failed shipment', () => {
    expect(
      queueStateLabel(state({ state: 'failed', error: 'Brak środków na koncie Furgonetki' })),
    ).toBe('błąd: Brak środków na koncie Furgonetki')
  })

  it('does not write „null” for a failed shipment without a reason', () => {
    expect(queueStateLabel(state({ state: 'failed' }))).toBe('błąd')
  })

  it('names the day and hours of a booked courier pickup', () => {
    expect(
      queueStateLabel(
        state({
          state: 'ready',
          pickup: 'courier',
          pickupStatus: 'ordered',
          pickupWindow: WINDOW,
        }),
      ),
    ).toBe('odbiór zamówiony na śr 4 lis, 10:00–15:00')
  })

  it('says a drop-off shipment goes to a point', () => {
    expect(
      queueStateLabel(state({ state: 'ready', pickup: 'drop_off', pickupStatus: 'none' })),
    ).toBe('nadanie w punkcie')
  })

  it('says a courier pickup that failed is not ordered', () => {
    expect(
      queueStateLabel(
        state({
          state: 'ready',
          pickup: 'courier',
          pickupStatus: 'failed',
          error: 'Furgonetka nie zamówiła odbioru.',
        }),
      ),
    ).toBe('odbiór niezamówiony')
  })

  it('calls a ready shipment whose pickup is not decided „etykieta gotowa”', () => {
    expect(
      queueStateLabel(state({ state: 'ready', pickup: 'courier', pickupStatus: 'none' })),
    ).toBe('etykieta gotowa')
    // A booking without its window cannot be written out; the label is still ready.
    expect(
      queueStateLabel(state({ state: 'ready', pickup: 'courier', pickupStatus: 'ordered' })),
    ).toBe('etykieta gotowa')
  })
})

describe('deliveryLabel', () => {
  it('writes the carrier and the locker code', () => {
    expect(deliveryLabel(delivery({ carrier: 'inpost_locker', lockerCode: 'KRA01M' }))).toBe(
      'Paczkomat InPost KRA01M',
    )
  })

  it('marks a carrier changed in the card', () => {
    expect(deliveryLabel(delivery({ changed: true }))).toBe('Kurier DPD (zmieniony)')
    expect(
      deliveryLabel(delivery({ carrier: 'inpost_locker', lockerCode: 'KRA01M', changed: true })),
    ).toBe('Paczkomat InPost KRA01M (zmieniony)')
  })

  it('names the carrier alone when there is no locker code', () => {
    expect(deliveryLabel(delivery({ carrier: 'inpost_courier' }))).toBe('Kurier InPost')
    expect(deliveryLabel(delivery({ carrier: 'inpost_locker' }))).toBe('Paczkomat InPost')
  })
})

describe('parcelsLabel', () => {
  it('writes a single parcel with its weight', () => {
    expect(parcelsLabel([BOARD])).toBe('Karton deski 15 kg')
  })

  it('counts identical parcels', () => {
    expect(parcelsLabel([BOARD, BOARD])).toBe('2 × Karton deski 15 kg')
  })

  it('joins different parcels with a plus', () => {
    expect(parcelsLabel([BOARD, SMALL])).toBe('Karton deski 15 kg + Karton mały 3 kg')
  })

  it('groups the same parcel wherever it stands, keeping the order of first appearance', () => {
    expect(parcelsLabel([BOARD, SMALL, BOARD])).toBe('2 × Karton deski 15 kg + Karton mały 3 kg')
  })

  it('tells parcels of one name apart by weight and by size', () => {
    expect(parcelsLabel([parcel('Karton', 3000), parcel('Karton', 2500)])).toBe(
      'Karton 3 kg + Karton 2,5 kg',
    )
    expect(parcelsLabel([parcel('Karton', 3000), parcel('Karton', 3000, { height_cm: 40 })])).toBe(
      'Karton 3 kg + Karton 3 kg',
    )
  })

  it('writes a dash when the plan has no parcels', () => {
    expect(parcelsLabel([])).toBe('–')
  })
})

describe('carrierSummary', () => {
  it('counts the shipments per carrier', () => {
    expect(
      carrierSummary([
        delivery(),
        delivery({ carrier: 'inpost_locker', lockerCode: 'KRA01M' }),
        delivery(),
      ]),
    ).toBe('DPD: 2, Paczkomat InPost: 1')
  })

  it('keeps a fixed order of carriers whatever the order of the rows', () => {
    expect(
      carrierSummary([
        delivery({ carrier: 'inpost_locker' }),
        delivery({ carrier: 'inpost_courier' }),
        delivery(),
      ]),
    ).toBe('DPD: 1, Kurier InPost: 1, Paczkomat InPost: 1')
  })

  it('is empty without rows', () => {
    expect(carrierSummary([])).toBe('')
  })
})

describe('resultLabel', () => {
  const result = (over: Partial<Parameters<typeof resultLabel>[0]> = {}) => ({
    orderId: 'order_1',
    shipmentId: 'shp_1',
    ok: true,
    message: null,
    ...over,
  })

  it('says the label is ready', () => {
    expect(resultLabel(result(), 'create')).toBe('etykieta gotowa')
  })

  it('adds the pickup problem to a label that is ready', () => {
    expect(resultLabel(result({ message: 'Furgonetka nie zamówiła odbioru.' }), 'create')).toBe(
      'etykieta gotowa, odbiór niezamówiony: Furgonetka nie zamówiła odbioru.',
    )
  })

  it('gives the reason of a failure', () => {
    expect(resultLabel(result({ ok: false, message: 'Brak usługi DPD' }), 'create')).toBe(
      'błąd: Brak usługi DPD',
    )
    expect(resultLabel(result({ ok: false }), 'create')).toBe('błąd')
  })

  it('says a pickup was booked', () => {
    expect(resultLabel(result(), 'pickup')).toBe('odbiór zamówiony')
    expect(resultLabel(result({ ok: false, message: 'Odmowa' }), 'pickup')).toBe('błąd: Odmowa')
  })
})

describe('orderDateText', () => {
  it('writes the date and the time in Warsaw', () => {
    // 09:15 UTC is 10:15 in Warsaw in November.
    expect(orderDateText('2026-11-03T09:15:00.000Z')).toBe('3 lis 2026, 10:15')
  })

  it('follows summer time', () => {
    expect(orderDateText('2026-07-03T09:15:00.000Z')).toBe('3 lip 2026, 11:15')
  })
})

describe('batchToast', () => {
  const done = (over: Partial<CreateResult> = {}): CreateResult => ({
    orderId: 'order_1',
    shipmentId: 'shp_1',
    ok: true,
    message: null,
    ...over,
  })
  const failed = (): CreateResult => done({ ok: false, message: 'Brak usługi DPD' })

  it('is a success when every shipment is made', () => {
    expect(batchToast([done(), done()], 'create')).toEqual({
      kind: 'success',
      text: 'Utworzono przesyłki: 2',
    })
  })

  it('warns when some shipments failed or a pickup was not ordered', () => {
    expect(batchToast([done(), failed()], 'create')).toEqual({
      kind: 'warning',
      text: 'Utworzono 1 z 2 przesyłek – sprawdź wiersze z uwagami',
    })
    expect(batchToast([done(), done({ message: 'Odmowa' })], 'create')).toEqual({
      kind: 'warning',
      text: 'Utworzono 2 z 2 przesyłek – sprawdź wiersze z uwagami',
    })
  })

  it('is an error when nothing was made', () => {
    expect(batchToast([failed(), failed()], 'create')).toEqual({
      kind: 'error',
      text: 'Nie utworzono żadnej przesyłki – powody są w wierszach',
    })
  })

  it('words the pickup retries on their own', () => {
    expect(batchToast([done()], 'pickup')).toEqual({
      kind: 'success',
      text: 'Zamówiono odbiór: 1',
    })
    expect(batchToast([done(), failed()], 'pickup').text).toBe(
      'Zamówiono 1 z 2 odbiorów – sprawdź wiersze z uwagami',
    )
    expect(batchToast([failed()], 'pickup')).toEqual({
      kind: 'error',
      text: 'Nie zamówiono żadnego odbioru – powody są w wierszach',
    })
  })
})

describe('ordersCount', () => {
  it.each([
    [0, '0 zamówień'],
    [1, '1 zamówienie'],
    [2, '2 zamówienia'],
    [4, '4 zamówienia'],
    [5, '5 zamówień'],
    [12, '12 zamówień'],
    [14, '14 zamówień'],
    [22, '22 zamówienia'],
    [100, '100 zamówień'],
    [112, '112 zamówień'],
  ])('%i → %s', (count, text) => {
    expect(ordersCount(count)).toBe(text)
  })
})

// ---------------------------------------------------------------------------------------------
// The „Wysyłka” card of an order (spec 6d §5.5)
// ---------------------------------------------------------------------------------------------

const view = (over: Partial<AdminShipmentView> = {}): AdminShipmentView => ({
  id: 'shp_1',
  state: 'ready',
  carrier: 'dpd',
  tracking: [],
  pickup: 'courier',
  pickupStatus: 'ordered',
  pickupWindow: WINDOW,
  history: [],
  lastError: null,
  cancelError: null,
  ...over,
})

type CardFields = Pick<AdminShipmentResponse, 'blockers' | 'order' | 'shipment' | 'actions'>

const card = (
  over: Partial<Omit<CardFields, 'order' | 'actions'>> & {
    order?: Partial<CardFields['order']>
    actions?: Partial<CardFields['actions']>
  } = {},
): CardFields => ({
  blockers: [],
  shipment: null,
  ...over,
  order: { paid: true, canceled: false, bulky: false, manualFulfillment: false, ...over.order },
  actions: {
    save: false,
    create: false,
    restore: false,
    cancel: false,
    pickup: false,
    label: false,
    ...over.actions,
  },
})

describe('cardWarning', () => {
  it('has nothing to say about an order that can be shipped', () => {
    expect(cardWarning(card({ actions: { save: true, create: true } }))).toBeNull()
    expect(cardWarning(card({ shipment: view(), actions: { cancel: true } }))).toBeNull()
  })

  it('asks to cancel the shipment of a canceled order', () => {
    expect(
      cardWarning(card({ order: { canceled: true }, shipment: view(), actions: { cancel: true } })),
    ).toBe('Zamówienie anulowane – anuluj przesyłkę')
  })

  it('does not ask to cancel a shipment that cannot be canceled, or one that does not exist', () => {
    expect(cardWarning(card({ order: { canceled: true }, shipment: view() }))).toBeNull()
    expect(cardWarning(card({ order: { canceled: true } }))).toBeNull()
  })

  it('says an order fulfilled by hand has no Furgonetka shipment', () => {
    expect(cardWarning(card({ order: { manualFulfillment: true } }))).toBe(
      'Zrealizowane ręcznie – bez przesyłki Furgonetki',
    )
  })

  it('says a package Furgonetka did not cancel is still there, before anything else', () => {
    const shipment = view({
      state: 'canceled',
      cancelError: 'Przesyłka w Furgonetce nie została anulowana – anuluj ją w Furgonetce',
    })
    const text = 'Przesyłka w Furgonetce nie została anulowana – anuluj ją w Furgonetce'

    expect(cardWarning(card({ shipment, actions: { cancel: true } }))).toBe(text)
    expect(
      cardWarning(
        card({ order: { canceled: true }, shipment, blockers: ['x'], actions: { cancel: true } }),
      ),
    ).toBe(text)
  })

  it.each(['in_transit', 'delivered', 'problem'] as const)(
    'says a %s shipment can only be canceled in Furgonetka',
    (state) => {
      expect(cardWarning(card({ shipment: view({ state }) }))).toBe(
        'Przesyłka jest już u przewoźnika – anulowanie tylko przez Furgonetkę',
      )
    },
  )

  it('says a shipment that is being created cannot be changed', () => {
    expect(cardWarning(card({ shipment: view({ state: 'creating' }) }))).toBe(
      'Przesyłka jest właśnie tworzona – odśwież stronę za chwilę.',
    )
  })

  it('gives the blockers of the page last, one after another', () => {
    const blocker = 'Furgonetka nie jest połączona – połącz konto w Settings → Wysyłka'
    const sender = 'Uzupełnij adres i telefon magazynu (Settings → Locations)'

    expect(cardWarning(card({ blockers: [blocker] }))).toBe(blocker)
    expect(cardWarning(card({ blockers: [blocker, sender] }))).toBe(`${blocker}. ${sender}`)
    expect(cardWarning(card({ blockers: [blocker], order: { manualFulfillment: true } }))).toBe(
      'Zrealizowane ręcznie – bez przesyłki Furgonetki',
    )
  })
})

describe('historyLabel', () => {
  it('writes the time in Warsaw and the carrier’s own words', () => {
    expect(
      historyLabel({ at: '2026-11-03T09:15:00.000Z', status: 'collected', label: 'Odebrana' }),
    ).toBe('3 lis 2026, 10:15 – Odebrana')
  })

  it('falls back to the status when the carrier gave no words', () => {
    expect(historyLabel({ at: '2026-11-03T09:15:00.000Z', status: 'transit', label: null })).toBe(
      '3 lis 2026, 10:15 – transit',
    )
  })

  it('writes the words alone when the time is not a time', () => {
    expect(historyLabel({ at: 'wczoraj', status: 'transit', label: 'W drodze' })).toBe('W drodze')
  })
})

describe('shipmentStateLabel', () => {
  it.each([
    ['ready', 'etykieta gotowa'],
    ['in_transit', 'w drodze'],
    ['delivered', 'doręczona'],
    ['problem', 'problem z przesyłką'],
  ] as const)('%s → %s', (state, text) => {
    expect(shipmentStateLabel(state)).toBe(text)
  })
})

describe('pickupLine', () => {
  it('writes the day and hours of a booked pickup', () => {
    expect(pickupLine(view())).toBe('śr 4 lis, 10:00–15:00')
  })

  it('says a shipment taken to a point goes there', () => {
    expect(pickupLine(view({ pickup: 'drop_off', pickupStatus: 'none', pickupWindow: null }))).toBe(
      'nadanie w punkcie',
    )
  })

  it('says a pickup that was not ordered is not', () => {
    expect(
      pickupLine(view({ pickupStatus: 'failed', pickupWindow: null, lastError: 'Odmowa' })),
    ).toBe('niezamówiony')
    expect(pickupLine(view({ pickupStatus: 'ordered', pickupWindow: null }))).toBe('niezamówiony')
    // The window asked for stays on a row whose booking failed – it is not a booked pickup.
    expect(pickupLine(view({ pickupStatus: 'failed' }))).toBe('niezamówiony')
  })
})

describe('cardToast', () => {
  const result = (over: Partial<CreateResult> = {}): CreateResult => ({
    orderId: 'order_1',
    shipmentId: 'shp_1',
    ok: true,
    message: null,
    ...over,
  })

  it('words a shipment that was made', () => {
    expect(cardToast(result(), 'create')).toEqual({ kind: 'success', text: 'Utworzono przesyłkę' })
  })

  it('warns when the label is ready and the pickup was not ordered', () => {
    expect(cardToast(result({ message: 'Furgonetka nie zamówiła odbioru.' }), 'create')).toEqual({
      kind: 'warning',
      text: 'Utworzono przesyłkę, odbiór niezamówiony: Furgonetka nie zamówiła odbioru.',
    })
  })

  it('gives the reason a shipment was not made', () => {
    expect(cardToast(result({ ok: false, message: 'Brak usługi DPD' }), 'create')).toEqual({
      kind: 'error',
      text: 'Brak usługi DPD',
    })
    expect(cardToast(result({ ok: false }), 'create')).toEqual({
      kind: 'error',
      text: 'Nie udało się utworzyć przesyłki.',
    })
  })

  it('words the pickup order', () => {
    expect(cardToast(result(), 'pickup')).toEqual({ kind: 'success', text: 'Zamówiono odbiór' })
    expect(cardToast(result({ ok: false, message: 'Odmowa' }), 'pickup')).toEqual({
      kind: 'error',
      text: 'Odmowa',
    })
    expect(cardToast(result({ ok: false }), 'pickup')).toEqual({
      kind: 'error',
      text: 'Nie udało się zamówić odbioru.',
    })
  })
})

describe('the declared value in złoty', () => {
  it.each([
    [4990, '49,90'],
    [4900, '49,00'],
    [5, '0,05'],
    [0, '0,00'],
    [123456, '1234,56'],
  ])('%i grosze → %s', (cents, text) => {
    expect(zlInput(cents)).toBe(text)
    expect(centsFromZl(text)).toBe(cents)
  })

  it.each([
    ['49', 4900],
    ['49.9', 4990],
    ['49,5', 4950],
    [' 49,90 ', 4990],
    ['0', 0],
  ])('reads %j as %i grosze', (text, cents) => {
    expect(centsFromZl(text)).toBe(cents)
  })

  it.each(['', ' ', 'abc', '49,999', '-5', '1 000', '49,'])('does not read %j', (text) => {
    expect(centsFromZl(text)).toBeNull()
  })
})

const TEMPLATES: CardTemplate[] = [
  {
    id: 'pt_board',
    name: 'Karton deski',
    kind: 'box',
    length_cm: 95,
    width_cm: 45,
    height_cm: 30,
    weight_g: 15000,
    purpose: 'board',
  },
  {
    id: 'pt_small',
    name: 'Karton mały',
    kind: 'box',
    length_cm: 40,
    width_cm: 30,
    height_cm: 20,
    weight_g: 3000,
    purpose: 'accessories_courier',
  },
  {
    id: 'pt_a',
    name: 'Paczkomat A',
    kind: 'locker_a',
    length_cm: 64,
    width_cm: 38,
    height_cm: 8,
    weight_g: 2000,
    purpose: 'accessories_locker',
  },
  {
    id: 'pt_b',
    name: 'Paczkomat B',
    kind: 'locker_b',
    length_cm: 64,
    width_cm: 38,
    height_cm: 19,
    weight_g: 5000,
    purpose: null,
  },
]

const PLAN: ShipmentPlan = {
  carrier: 'dpd',
  receiver: {
    name: 'Jan Kowalski',
    company: null,
    phone: '+48501234567',
    email: 'jan@example.pl',
    street: 'ul. Morska 5',
    postal_code: '80-001',
    city: 'Gdańsk',
    point: null,
    point_label: null,
  },
  parcels: [templateParcel(TEMPLATES[1] as CardTemplate)],
  declaredValueCents: 12990,
  pickup: 'courier',
}

const LOCKER_PLAN: ShipmentPlan = {
  ...PLAN,
  carrier: 'inpost_locker',
  receiver: {
    ...PLAN.receiver,
    street: null,
    postal_code: null,
    city: null,
    point: 'KRA01M',
    point_label: 'ul. Krakowska 1, 30-001 Kraków',
  },
  parcels: [templateParcel(TEMPLATES[2] as CardTemplate)],
}

const TERM = { date: '2026-11-04', from: '10:00', to: '15:00' }

describe('templatesFor', () => {
  it('offers the cartons to a courier and the sizes to a parcel locker', () => {
    expect(templatesFor('dpd', TEMPLATES).map((t) => t.id)).toEqual(['pt_board', 'pt_small'])
    expect(templatesFor('inpost_courier', TEMPLATES).map((t) => t.id)).toEqual([
      'pt_board',
      'pt_small',
    ])
    expect(templatesFor('inpost_locker', TEMPLATES).map((t) => t.id)).toEqual(['pt_a', 'pt_b'])
  })
})

describe('the form of the card', () => {
  it('starts from the plan, in the texts of the inputs', () => {
    expect(formOf(PLAN)).toEqual({
      carrier: 'dpd',
      phone: '+48501234567',
      street: 'ul. Morska 5',
      postalCode: '80-001',
      city: 'Gdańsk',
      point: '',
      pointLabel: '',
      parcels: [
        {
          template_id: 'pt_small',
          name: 'Karton mały',
          kind: 'box',
          length: '40',
          width: '30',
          height: '20',
          weight: '3',
        },
      ],
      value: '129,90',
      way: 'courier',
    })
  })

  it.each([
    ['a courier plan', PLAN],
    ['a locker plan', LOCKER_PLAN],
    [
      'a plan with odd values',
      {
        ...PLAN,
        receiver: { ...PLAN.receiver, company: 'ACME', phone: '  50 123 ', city: '' },
        parcels: [
          { ...templateParcel(TEMPLATES[0] as CardTemplate), weight_g: 1234 },
          { ...templateParcel(TEMPLATES[1] as CardTemplate), template_id: null },
        ],
        declaredValueCents: 5,
        pickup: 'drop_off' as const,
      },
    ],
  ])('sends %s back exactly as it came when nothing was edited', (_name, plan) => {
    expect(draftOf(formOf(plan), plan)).toEqual({ draft: plan })
  })

  it('changes only what was edited', () => {
    const form = {
      ...formOf(PLAN),
      phone: ' 600 100 200 ',
      street: 'ul. Portowa 7',
      value: '10',
    }

    const result = draftOf(form, PLAN)

    expect(result).toEqual({
      draft: {
        ...PLAN,
        receiver: { ...PLAN.receiver, phone: '600 100 200', street: 'ul. Portowa 7' },
        declaredValueCents: 1000,
      },
    })
  })

  it('writes a field that was cleared as null, not as an empty text', () => {
    const form = { ...formOf(LOCKER_PLAN), pointLabel: '  ', point: '' }

    expect(draftOf(form, LOCKER_PLAN)).toEqual({
      draft: {
        ...LOCKER_PLAN,
        receiver: { ...LOCKER_PLAN.receiver, point: null, point_label: null },
      },
    })
  })

  it('takes the way of leaving as the pickup of the draft', () => {
    const form: CardForm = { ...formOf(PLAN), way: 'drop_off' }

    expect(draftOf(form, PLAN)).toEqual({ draft: { ...PLAN, pickup: 'drop_off' } })
  })

  it('reads edited sizes and weights', () => {
    const base = formOf(PLAN)
    const [parcel] = base.parcels
    const form = {
      ...base,
      parcels: [{ ...parcel, length: '41', width: '31', height: '21', weight: '2,5' }],
    } as CardForm

    expect(draftOf(form, PLAN)).toEqual({
      draft: {
        ...PLAN,
        parcels: [
          { ...PLAN.parcels[0], length_cm: 41, width_cm: 31, height_cm: 21, weight_g: 2500 },
        ],
      },
    })
  })

  it('does not send a size or a weight that is no number', () => {
    const base = formOf(PLAN)
    const [parcel] = base.parcels
    for (const change of [
      { length: '' },
      { width: 'abc' },
      { height: '1 2' },
      { weight: '2,5kg' },
    ]) {
      const form = { ...base, parcels: [{ ...parcel, ...change }] } as CardForm

      expect(draftOf(form, PLAN)).toEqual({
        error: 'Wymiary i waga paczki muszą być liczbami (waga w kg, np. 2,5).',
      })
    }
  })

  it('does not send a declared value that is no amount', () => {
    expect(draftOf({ ...formOf(PLAN), value: 'dużo' }, PLAN)).toEqual({
      error: 'Podaj wartość deklarowaną w zł, np. 49,90.',
    })
  })

  it('chooses the pickup choice of the batch from the way and the term', () => {
    expect(pickupOf(formOf(PLAN), TERM)).toEqual({ type: 'courier', ...TERM })
    expect(pickupOf({ ...formOf(PLAN), way: 'drop_off' }, TERM)).toEqual({ type: 'drop_off' })
  })

  it('wants a day and hours for a courier pickup, but not for a drop-off', () => {
    const form = formOf(PLAN)
    const message = 'Podaj dzień i godziny odbioru – początek przed końcem.'

    expect(termProblem(form, TERM)).toBeNull()
    expect(termProblem(form, { ...TERM, date: '' })).toBe(message)
    expect(termProblem(form, { ...TERM, from: '' })).toBe(message)
    expect(termProblem(form, { ...TERM, from: '15:00', to: '10:00' })).toBe(message)
    expect(termProblem(form, { ...TERM, from: '10:00', to: '10:00' })).toBe(message)
    expect(termProblem({ ...form, way: 'drop_off' }, { ...TERM, date: '' })).toBeNull()
  })
})

describe('the pickup window of the card', () => {
  const FALLBACK = { date: '2026-11-05', from: '10:00', to: '15:00' }
  const CHOSEN = { date: '2026-11-09', from: '11:30', to: '14:00' }
  const chosen = (orderId = 'order_1'): ChosenTerm => ({ orderId, term: CHOSEN })

  it('is the default until the operator picks a window', () => {
    expect(termOf(null, 'order_1', FALLBACK)).toBe(FALLBACK)
  })

  it('is the window the operator picked for this order, whatever the default says now', () => {
    expect(termOf(chosen(), 'order_1', FALLBACK)).toBe(CHOSEN)
    expect(termOf(chosen(), 'order_1', { ...FALLBACK, date: '2026-11-06' })).toBe(CHOSEN)
  })

  it('does not carry over to another order', () => {
    expect(termOf(chosen('order_1'), 'order_2', FALLBACK)).toBe(FALLBACK)
  })

  it('outlives the form: a plan that changed restarts the form, the window booked stays', () => {
    // „Zapisz” or a failed try gives the card a saved plan that differs from the loaded one; the
    // form is built again from it, but the window does not come from the form.
    const saved: ShipmentPlan = {
      ...PLAN,
      receiver: { ...PLAN.receiver, phone: '+48600100200', street: 'ul. Portowa 7' },
    }

    const restarted = formOf(saved)

    expect(pickupOf(restarted, termOf(chosen(), 'order_1', FALLBACK))).toEqual({
      type: 'courier',
      ...CHOSEN,
    })
    expect(termProblem(restarted, termOf(chosen(), 'order_1', FALLBACK))).toBeNull()
  })
})

describe('changing the carrier in the card', () => {
  it('only changes the carrier between two couriers', () => {
    const form = formOf(PLAN)

    expect(changeCarrier(form, 'inpost_courier', TEMPLATES, false)).toEqual({
      ...form,
      carrier: 'inpost_courier',
    })
  })

  it('gives a parcel locker one locker parcel', () => {
    const form = changeCarrier(formOf(PLAN), 'inpost_locker', TEMPLATES, false)

    expect(form.carrier).toBe('inpost_locker')
    expect(form.parcels).toEqual([
      expect.objectContaining({ template_id: 'pt_a', name: 'Paczkomat A', kind: 'locker_a' }),
    ])
  })

  it('gives a courier a carton: for a board the board carton, else the accessories one', () => {
    const lockerForm = formOf(LOCKER_PLAN)

    expect(changeCarrier(lockerForm, 'dpd', TEMPLATES, true).parcels).toEqual([
      expect.objectContaining({ template_id: 'pt_board', name: 'Karton deski' }),
    ])
    expect(changeCarrier(lockerForm, 'dpd', TEMPLATES, false).parcels).toEqual([
      expect.objectContaining({ template_id: 'pt_small', name: 'Karton mały' }),
    ])
  })

  it('keeps the address and the locker, so that changing back loses nothing', () => {
    const toDpd = changeCarrier(formOf(LOCKER_PLAN), 'dpd', TEMPLATES, false)

    expect(toDpd.point).toBe('KRA01M')
    expect(toDpd.pointLabel).toBe('ul. Krakowska 1, 30-001 Kraków')
  })

  it('falls back to the first template of the kind when the purpose has none, and to no parcels', () => {
    const noPurposes = TEMPLATES.map((t) => ({ ...t, purpose: null }))
    const form = formOf(PLAN)

    expect(changeCarrier(form, 'inpost_locker', noPurposes, false).parcels[0]?.template_id).toBe(
      'pt_a',
    )
    expect(changeCarrier(form, 'inpost_locker', [], false).parcels).toEqual([])
  })
})

describe('adding a parcel', () => {
  it('adds the accessories carton for a courier', () => {
    const form = addParcel(formOf(PLAN), TEMPLATES)

    expect(form.parcels.map((p) => p.template_id)).toEqual(['pt_small', 'pt_small'])
  })

  it('falls back to the first carton when there is no accessories one', () => {
    const noPurposes = TEMPLATES.map((t) => ({ ...t, purpose: null }))

    expect(addParcel(formOf(PLAN), noPurposes).parcels.map((p) => p.template_id)).toEqual([
      'pt_small',
      'pt_board',
    ])
  })

  it('adds nothing to a parcel locker, which has one parcel, or when there is no template', () => {
    const locker = formOf(LOCKER_PLAN)
    const courier = formOf(PLAN)

    expect(addParcel(locker, TEMPLATES)).toBe(locker)
    expect(addParcel(courier, [])).toBe(courier)
  })
})

describe('formParcelOf', () => {
  it('writes the template into the texts of the inputs', () => {
    expect(formParcelOf(TEMPLATES[0] as CardTemplate)).toEqual({
      template_id: 'pt_board',
      name: 'Karton deski',
      kind: 'box',
      length: '95',
      width: '45',
      height: '30',
      weight: '15',
    })
  })
})

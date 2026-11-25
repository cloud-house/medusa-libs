import type { ShipmentRow, TemplateRow } from '../../modules/furgonetka/service'
import type { ShippingOrder } from '../../types'
import { toPackageBody } from '../client'
import { planProblems, shipmentPlan } from '../plan'
import { DEFAULT_TEMPLATES } from './default-templates'

/**
 * Safety net for kit step 4c: what the shop plans and sends to Furgonetka must stay the same after
 * the code moves into the plugin – the parcels (names, dimensions, order), the problems and the
 * `POST /packages` body. The snapshot file must not change when the shop switches to the package.
 */
const at = new Date('2026-11-03T10:00:00.000Z')

const templates: TemplateRow[] = DEFAULT_TEMPLATES.map((template, index) => ({
  ...template,
  id: `ptpl_${index}`,
  created_at: at,
  updated_at: at,
  deleted_at: null,
}))

const item = (
  id: string,
  title: string,
  quantity: number,
  parcelClass: 'board' | 'courier_only' | null,
) => ({ id, title, quantity, variant: null, productId: null, parcelClass })

const SETTINGS = {
  classes: [
    { key: 'board', label: 'Deska', carriers: ['dpd' as const] },
    { key: 'courier_only', label: 'Tylko kurier', carriers: ['dpd' as const] },
  ],
  codes: { inpostCourier: 'kurier-inpost', inpostLocker: 'paczkomat-inpost' },
}

const order = (overrides: Partial<ShippingOrder> = {}): ShippingOrder => ({
  id: 'order_1',
  displayId: 1001,
  createdAt: at,
  email: 'jan@example.com',
  customerName: 'Jan Kowalski',
  shopOrder: true,
  paid: true,
  canceled: false,
  deliveryCode: 'kurier-dpd',
  deliveryName: 'Kurier DPD',
  lockerCode: null,
  lockerLabel: null,
  address: {
    firstName: 'Jan',
    lastName: 'Kowalski',
    company: null,
    address1: 'ul. Morska 5',
    address2: 'm. 3',
    postalCode: '80-001',
    city: 'Gdańsk',
    phone: '600 100 200',
  },
  items: [item('i1', 'Deska SUP', 1, 'board')],
  itemsTotalCents: 249900,
  fulfillments: [],
  ...overrides,
})

const SENDER = {
  name: 'Magazyn',
  street: 'ul. Portowa 3',
  postal_code: '80-002',
  city: 'Gdańsk',
  phone: '+48600100200',
  email: 'sklep@example.com',
}

const CASES: [string, ShippingOrder][] = [
  ['DPD, one board', order()],
  [
    'DPD, board and accessories',
    order({ items: [item('i1', 'Deska', 1, 'board'), item('i2', 'Pompka', 2, null)] }),
  ],
  ['DPD, two pieces of a board', order({ items: [item('i1', 'Deska', 2, 'board')] })],
  [
    'DPD, courier-only product and accessories',
    order({ items: [item('i1', 'Wiosło', 1, 'courier_only'), item('i2', 'Leash', 1, null)] }),
  ],
  [
    'InPost courier, accessories',
    order({
      deliveryCode: 'kurier-inpost',
      deliveryName: 'Kurier InPost',
      items: [item('i2', 'Pompka', 2, null)],
    }),
  ],
  [
    'InPost courier with a board (blocked)',
    order({ deliveryCode: 'kurier-inpost', deliveryName: 'Kurier InPost' }),
  ],
  [
    'parcel locker, accessories',
    order({
      deliveryCode: 'paczkomat-inpost',
      deliveryName: 'Paczkomat InPost',
      lockerCode: 'KRA01M',
      lockerLabel: 'ul. Krakowska 1, 30-001 Kraków',
      items: [item('i2', 'Pompka', 2, null)],
    }),
  ],
]

describe('plan and API body parity', () => {
  it.each(CASES)('%s', (_name, o) => {
    const plan = shipmentPlan(o, null as unknown as ShipmentRow | null, templates, SETTINGS)
    const problems = planProblems(o, plan, SETTINGS)
    const body =
      'missing' in plan
        ? null
        : toPackageBody({
            reference: String(o.displayId),
            serviceId: 7,
            carrier: plan.carrier,
            receiver: plan.receiver,
            sender: SENDER,
            parcels: plan.parcels,
            declaredValueCents: plan.declaredValueCents,
            pickup: plan.pickup,
          })

    expect({ plan, problems, body }).toMatchSnapshot()
  })
})

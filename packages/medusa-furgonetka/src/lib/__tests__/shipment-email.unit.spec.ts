import type { ShipmentReceiver, ShippingOrder } from '../../types'
import {
  destinationOfOrder,
  destinationOfReceiver,
  loadShipmentEmail,
  parcelNumbers,
} from '../shipment-email'
import { furgonetkaService } from './shop-options'

const receiver = (over: Partial<ShipmentReceiver> = {}): ShipmentReceiver => ({
  name: 'Jan Kowalski',
  company: null,
  phone: '+48600100200',
  email: 'jan@example.com',
  street: 'ul. Morska 5',
  postal_code: '80-001',
  city: 'Gdańsk',
  point: null,
  point_label: null,
  ...over,
})

describe('parcelNumbers', () => {
  it('takes the number and the link from the label', () => {
    expect(
      parcelNumbers('dpd', [
        { tracking_number: '0000123', tracking_url: 'https://x.pl/t/0000123' },
      ]),
    ).toEqual([{ number: '0000123', url: 'https://x.pl/t/0000123' }])
  })

  it('falls back to the carrier page when the label has no link', () => {
    expect(
      parcelNumbers('dpd', [
        { tracking_number: '0000123', tracking_url: '' },
        { tracking_number: '0000124', tracking_url: null },
      ]),
    ).toEqual([
      { number: '0000123', url: 'https://tracktrace.dpd.com.pl/parcelDetails?typ=1&p1=0000123' },
      { number: '0000124', url: 'https://tracktrace.dpd.com.pl/parcelDetails?typ=1&p1=0000124' },
    ])
    expect(parcelNumbers('inpost_locker', [{ tracking_number: '6200', tracking_url: '' }])).toEqual(
      [{ number: '6200', url: 'https://inpost.pl/sledzenie-przesylek?number=6200' }],
    )
  })

  it('uses the carrier page for the "#" the admin sends when only a number is typed', () => {
    expect(
      parcelNumbers('dpd', [
        { tracking_number: '0000123', tracking_url: '#' },
        { tracking_number: '0000124', tracking_url: 'javascript:alert(1)' },
      ]),
    ).toEqual([
      { number: '0000123', url: 'https://tracktrace.dpd.com.pl/parcelDetails?typ=1&p1=0000123' },
      { number: '0000124', url: 'https://tracktrace.dpd.com.pl/parcelDetails?typ=1&p1=0000124' },
    ])
  })

  it('skips labels without a number and trims the rest', () => {
    expect(
      parcelNumbers('dpd', [
        { tracking_number: '', tracking_url: 'https://x.pl' },
        { tracking_number: '  ', tracking_url: null },
        null,
        { tracking_number: ' 77 ', tracking_url: null },
      ]).map((parcel) => parcel.number),
    ).toEqual(['77'])
    expect(parcelNumbers('dpd', null)).toEqual([])
  })
})

describe('destinationOfReceiver', () => {
  it('names a parcel locker with its code and description', () => {
    expect(
      destinationOfReceiver(
        receiver({ point: 'KRA01M', point_label: 'ul. Długa 12, 31-147 Kraków', street: null }),
      ),
    ).toEqual({ title: 'Paczkomat KRA01M', lines: ['ul. Długa 12, 31-147 Kraków'] })
  })

  it('names a parcel locker without a description by its code only', () => {
    expect(destinationOfReceiver(receiver({ point: 'KRA01M' }))).toEqual({
      title: 'Paczkomat KRA01M',
      lines: [],
    })
  })

  it('gives a courier the name and the address', () => {
    expect(destinationOfReceiver(receiver())).toEqual({
      title: 'Jan Kowalski',
      lines: ['ul. Morska 5', '80-001 Gdańsk'],
    })
  })

  it('skips address parts that are missing', () => {
    expect(destinationOfReceiver(receiver({ street: null, postal_code: null }))).toEqual({
      title: 'Jan Kowalski',
      lines: ['Gdańsk'],
    })
  })
})

describe('destinationOfOrder', () => {
  const address = {
    firstName: 'Jan',
    lastName: 'Kowalski',
    address1: 'ul. Morska 5',
    address2: 'm. 3',
    postalCode: '80-001',
    city: 'Gdańsk',
  }
  const order = (over: Record<string, unknown> = {}) =>
    ({ deliveryCode: 'kurier-dpd', lockerCode: null, lockerLabel: null, address, ...over }) as never

  it('takes the parcel locker of the order for the locker delivery method', () => {
    expect(
      destinationOfOrder(
        order({
          deliveryCode: 'paczkomat-inpost',
          lockerCode: 'GDA12M',
          lockerLabel: 'Park Handlowy, Gdańsk',
        }),
        'paczkomat-inpost',
      ),
    ).toEqual({ title: 'Paczkomat GDA12M', lines: ['Park Handlowy, Gdańsk'] })
  })

  it('takes the receiver and the address of the order for a courier', () => {
    expect(destinationOfOrder(order(), 'paczkomat-inpost')).toEqual({
      title: 'Jan Kowalski',
      lines: ['ul. Morska 5', 'm. 3', '80-001 Gdańsk'],
    })
  })

  it('knows no destination for a locker without a code or an order without an address', () => {
    expect(
      destinationOfOrder(order({ deliveryCode: 'paczkomat-inpost' }), 'paczkomat-inpost'),
    ).toBeNull()
    expect(destinationOfOrder(order({ address: null }), 'paczkomat-inpost')).toBeNull()
  })

  it('follows the locker code the shop gives', () => {
    expect(
      destinationOfOrder(order({ deliveryCode: 'locker', lockerCode: 'X1' }), 'locker')?.title,
    ).toBe('Paczkomat X1')
  })
})

describe('loadShipmentEmail', () => {
  const ORDER = {
    id: 'order_1',
    displayId: 1001,
    email: 'jan@example.pl',
    shopOrder: true,
    hasAccount: true,
    deliveryCode: 'kurier-dpd',
    lockerCode: null,
    lockerLabel: null,
    address: {
      firstName: 'Jan',
      lastName: 'Kowalski',
      address1: 'ul. Morska 5',
      address2: null,
      postalCode: '80-001',
      city: 'Gdańsk',
    },
    items: [
      { id: 'line_1', title: 'Deska', variant: 'Turkus', quantity: 1, productId: 'p1' },
      { id: 'line_2', title: 'Pompka', variant: null, quantity: 2, productId: 'p2' },
    ],
  } as unknown as ShippingOrder

  /** `graph` answers by entity: the link to the order and the fulfillment with its labels. */
  function setup(
    options: { order?: unknown; contact?: unknown; link?: unknown[]; shipment?: unknown } = {},
  ) {
    const graph = jest.fn(async ({ entity }: { entity: string }) => {
      if (entity === 'order_fulfillment') {
        return { data: options.link ?? [{ order_id: 'order_1' }] }
      }
      return {
        data: [
          {
            id: 'ful_1',
            labels: [{ tracking_number: '0000123', tracking_url: '' }],
            items: [{ line_item_id: 'line_1', quantity: 1 }],
          },
        ],
      }
    })
    const logger = { warn: jest.fn(), error: jest.fn(), info: jest.fn() }
    const service = {
      ...furgonetkaService(options.contact),
      shipmentByFulfillment: jest.fn().mockResolvedValue(options.shipment ?? null),
    }
    const original = service.getOptions
    service.getOptions = () => ({
      ...original(),
      resolveOrder: async () => ('order' in options ? options.order : ORDER) as never,
      accountOrderPath: '/konto/zamowienia/:id',
    })
    const services: Record<string, unknown> = { query: { graph }, logger, furgonetka: service }
    return { container: { resolve: (key: string) => services[key] } as never, logger }
  }
  const env = { STOREFRONT_URL: 'https://shop.example/' }

  it('has nothing to send for a fulfillment no order owns', async () => {
    const { container } = setup({ link: [] })

    expect(await loadShipmentEmail(container, 'ful_1', env)).toBeNull()
  })

  it('has nothing to send for an order not placed in the shop', async () => {
    const { container } = setup({ order: { ...ORDER, shopOrder: false } })

    expect(await loadShipmentEmail(container, 'ful_1', env)).toBeNull()
  })

  it('has nothing to send for an order without an e-mail address', async () => {
    const { container } = setup({ order: { ...ORDER, email: null } })

    expect(await loadShipmentEmail(container, 'ful_1', env)).toBeNull()
  })

  it('builds the e-mail from the order, the fulfillment and the shop contact', async () => {
    const { container } = setup()

    const email = await loadShipmentEmail(container, 'ful_1', env)

    expect(email).toMatchObject({
      to: 'jan@example.pl',
      orderId: 'order_1',
      replyTo: 'kontakt@shop.example',
      data: {
        displayId: 1001,
        carrier: 'Kurier DPD',
        parcels: [
          {
            number: '0000123',
            url: 'https://tracktrace.dpd.com.pl/parcelDetails?typ=1&p1=0000123',
          },
        ],
        destination: { title: 'Jan Kowalski', lines: ['ul. Morska 5', '80-001 Gdańsk'] },
        // Only what the fulfillment ships.
        items: [{ name: 'Deska – Turkus', quantity: 1 }],
        accountUrl: 'https://shop.example/konto/zamowienia/order_1',
        shopUrl: 'https://shop.example',
        contact: { canReply: true, email: 'kontakt@shop.example' },
      },
    })
  })

  it('a guest order has no account link', async () => {
    const { container } = setup({ order: { ...ORDER, hasAccount: false } })

    expect((await loadShipmentEmail(container, 'ful_1', env))?.data.accountUrl).toBeNull()
  })

  it('EMAIL_REPLY_TO wins over the contact address', async () => {
    const { container } = setup()

    const email = await loadShipmentEmail(container, 'ful_1', {
      ...env,
      EMAIL_REPLY_TO: 'pomoc@shop.example',
    })

    expect(email?.replyTo).toBe('pomoc@shop.example')
  })

  it('a contact resolver that throws sends the e-mail without contact data and logs it', async () => {
    const { container, logger } = setup({ contact: new Error('cms down') })

    const email = await loadShipmentEmail(container, 'ful_1', env)

    expect(email?.data.contact).toEqual({ canReply: false, email: null, phone: null, hours: null })
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('zamówienie #1001'))
  })

  it('a Furgonetka shipment row names the carrier and the destination', async () => {
    const { container } = setup({
      shipment: {
        carrier: 'inpost_locker',
        receiver: {
          name: 'Jan Kowalski',
          company: null,
          phone: '+48600100200',
          email: null,
          street: null,
          postal_code: null,
          city: null,
          point: 'KRA01M',
          point_label: 'ul. Długa 12, 31-147 Kraków',
        },
        parcels: [],
      },
    })

    const email = await loadShipmentEmail(container, 'ful_1', env)

    expect(email?.data.carrier).toBe('Paczkomat InPost')
    expect(email?.data.destination).toEqual({
      title: 'Paczkomat KRA01M',
      lines: ['ul. Długa 12, 31-147 Kraków'],
    })
  })
})

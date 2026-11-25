import type { ShipmentEmailData } from '../types'
import { renderShippingEmail } from './render'

const data = (over: Partial<ShipmentEmailData> = {}): ShipmentEmailData => ({
  displayId: 1001,
  carrier: 'Kurier DPD',
  parcels: [
    { number: '0000123', url: 'https://tracktrace.dpd.com.pl/parcelDetails?typ=1&p1=0000123' },
  ],
  destination: {
    title: 'Jan Kowalski',
    lines: ['ul. Morska 5', '80-001 Gdańsk'],
  },
  items: [
    { name: 'Allround Wave – Turkus · 10\'6"', quantity: 1 },
    { name: 'Pompka elektryczna 12 V', quantity: 2 },
  ],
  accountUrl: null,
  shopUrl: 'https://shop.example',
  contact: { canReply: true, email: 'sklep@shop.example', phone: null, hours: null },
  ...over,
})

const render = (over: Partial<ShipmentEmailData> = {}) =>
  renderShippingEmail('shipment', data(over) as unknown as Record<string, unknown>)

const flat = (text: string) => text.replace(/\s+/g, ' ')
// Headings come out upper-cased in the plain-text version, so they are checked in the html.
const lower = (text: string) => flat(text).toLowerCase()

describe('shipment e-mail', () => {
  it('announces the order, the carrier, the destination and the contents', async () => {
    const { subject, html, text, name } = await render()
    const plain = flat(text)

    expect(subject).toBe('Zamówienie nr 1001 jest w drodze')
    expect(name).toBe('shipment-1001')
    expect(html).toContain('Paczka w drodze')
    expect(plain).toContain('Twoje zamówienie nr 1001 jest już u przewoźnika: Kurier DPD.')
    expect(html).toContain('Dokąd jedzie paczka')
    expect(plain).toContain('Jan Kowalski')
    expect(plain).toContain('ul. Morska 5')
    expect(plain).toContain('80-001 Gdańsk')
    expect(html).toContain('Co jest w paczce')
    expect(plain).toContain('Allround Wave – Turkus · 10\'6" × 1')
    expect(plain).toContain('Pompka elektryczna 12 V × 2')
    expect(plain).toContain('sklep@shop.example')
  })

  it('links each parcel number to its tracking page', async () => {
    const { html } = await render({
      parcels: [
        { number: '0000123', url: 'https://tracktrace.dpd.com.pl/parcelDetails?typ=1&p1=0000123' },
        { number: '0000124', url: 'https://tracktrace.dpd.com.pl/parcelDetails?typ=1&p1=0000124' },
      ],
    })

    expect(html).toContain('Śledzenie przesyłki')
    expect(html).toContain(
      'href="https://tracktrace.dpd.com.pl/parcelDetails?typ=1&amp;p1=0000123"',
    )
    expect(html).toContain(
      'href="https://tracktrace.dpd.com.pl/parcelDetails?typ=1&amp;p1=0000124"',
    )
    expect(html).toContain('0000123')
    expect(html).toContain('0000124')
  })

  it('shows a number without a link as plain text', async () => {
    const { html, text } = await render({ parcels: [{ number: 'AB-77', url: null }] })

    expect(flat(text)).toContain('AB-77')
    expect(html).toContain('AB-77')
    expect(html).not.toContain('href="null"')
  })

  it('has no tracking section without parcels', async () => {
    const { text, html } = await render({ parcels: [] })

    expect(lower(text)).not.toContain('śledzenie przesyłki')
    expect(html).not.toContain('Śledzenie przesyłki')
    expect(flat(text)).toContain('Twoje zamówienie nr 1001 jest już u przewoźnika: Kurier DPD.')
  })

  it('names the parcel locker with its code and description', async () => {
    const { text } = await render({
      carrier: 'Paczkomat InPost',
      destination: { title: 'Paczkomat KRA01M', lines: ['ul. Długa 12, 31-147 Kraków'] },
    })
    const plain = flat(text)

    expect(plain).toContain('jest już u przewoźnika: Paczkomat InPost.')
    expect(plain).toContain('Paczkomat KRA01M')
    expect(plain).toContain('ul. Długa 12, 31-147 Kraków')
  })

  it('leaves out the destination when it is unknown', async () => {
    const { html, text } = await render({ destination: null })

    expect(html).not.toContain('Dokąd jedzie paczka')
    expect(lower(text)).not.toContain('dokąd jedzie paczka')
  })

  it('has the account button only with the account link', async () => {
    const without = await render()
    expect(flat(without.text)).not.toContain('Zobacz zamówienie w koncie')

    const withLink = await render({ accountUrl: 'https://shop.example/konto/zamowienia/order_1' })
    expect(flat(withLink.text)).toContain('Zobacz zamówienie w koncie')
    expect(withLink.html).toContain('https://shop.example/konto/zamowienia/order_1')
  })

  it('shows no contact card without a contact', async () => {
    const { text } = await render({ contact: null })

    expect(flat(text)).not.toContain('Masz pytania?')
  })
})

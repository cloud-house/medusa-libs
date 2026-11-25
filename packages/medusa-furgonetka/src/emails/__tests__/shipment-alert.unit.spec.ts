import type { ShipmentAlertEmailData } from '../types'
import { renderShippingEmail } from './render'

const data = (over: Partial<ShipmentAlertEmailData> = {}): ShipmentAlertEmailData => ({
  kind: 'problem',
  displayId: 1001,
  message: 'Przesyłka wróciła do nadawcy (DPD: adresat odmówił przyjęcia)',
  adminUrl: null,
  shopUrl: 'https://shop.example',
  ...over,
})

const render = (over: Partial<ShipmentAlertEmailData> = {}) =>
  renderShippingEmail('shipment-alert', data(over) as unknown as Record<string, unknown>)

const flat = (text: string) => text.replace(/\s+/g, ' ')

describe('shipment-alert e-mail', () => {
  it.each([
    ['problem', 'Problem z przesyłką – zamówienie #1001'],
    ['not_canceled', 'Przesyłka nieanulowana w Furgonetce – zamówienie #1001'],
  ] as const)('%s → %s', async (kind, subject) => {
    const rendered = await render({ kind })

    expect(rendered.subject).toBe(subject)
    expect(rendered.name).toBe(`shipment-alert-1001-${kind}`)
    expect(flat(rendered.text)).toContain('Przesyłka wróciła do nadawcy')
    expect(rendered.html).toContain(subject)
  })

  it('has a subject for a lost connection, which belongs to no order', async () => {
    const rendered = await render({
      kind: 'disconnected',
      displayId: null,
      message: 'Furgonetka odrzuciła autoryzację',
    })

    expect(rendered.subject).toBe('Furgonetka rozłączona – połącz ponownie')
    expect(rendered.name).toBe('shipment-alert-connection-disconnected')
    expect(flat(rendered.text)).toContain('Furgonetka odrzuciła autoryzację')
    expect(flat(rendered.text)).toContain('Settings → Wysyłka')
  })

  it('says what to do for each kind', async () => {
    const notCanceled = flat((await render({ kind: 'not_canceled' })).text)
    const problem = flat((await render({ kind: 'problem' })).text)

    expect(notCanceled).toContain('anuluj ją w Furgonetce')
    expect(problem).not.toContain('anuluj ją w Furgonetce')
  })

  it('links to the panel only when the admin address is known', async () => {
    const withLink = await render({ adminUrl: 'https://api.shop.example/app/orders/order_1' })
    const without = await render()

    expect(withLink.html).toContain('https://api.shop.example/app/orders/order_1')
    expect(flat(withLink.text)).toContain('Otwórz zamówienie w panelu')
    expect(without.html).not.toContain('/app/orders/')
    expect(flat(without.text)).not.toContain('Otwórz zamówienie w panelu')
    expect(flat(without.text)).toContain('#1001')
  })

  it('links a lost connection to the shipping settings, not to an order', async () => {
    const rendered = await render({
      kind: 'disconnected',
      displayId: null,
      adminUrl: 'https://api.shop.example/app/settings/wysylka',
    })

    expect(rendered.html).toContain('https://api.shop.example/app/settings/wysylka')
    expect(flat(rendered.text)).toContain('Otwórz ustawienia wysyłki')
    expect(flat(rendered.text)).not.toContain('Otwórz zamówienie w panelu')
  })

  it('leaves out the order number for an alert without one', async () => {
    const rendered = await render({ kind: 'problem', displayId: null })

    expect(rendered.subject).toBe('Problem z przesyłką')
    expect(rendered.name).toBe('shipment-alert-connection-problem')
  })
})

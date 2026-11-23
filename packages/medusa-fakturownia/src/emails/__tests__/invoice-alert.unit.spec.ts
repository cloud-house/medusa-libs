import type { InvoiceAlertEmailData } from '../../types'
import { renderInvoiceEmail } from './render'

const data = (over: Partial<InvoiceAlertEmailData> = {}): InvoiceAlertEmailData => ({
  displayId: 1001,
  orderId: 'order_1',
  kind: 'issue',
  message: 'Fakturownia odrzuciła żądanie (HTTP 422): buyer_tax_no: jest nieprawidłowy',
  adminUrl: null,
  shopUrl: 'https://shop.example',
  ...over,
})

const render = (over: Partial<InvoiceAlertEmailData> = {}) =>
  renderInvoiceEmail('invoice-alert', data(over) as unknown as Record<string, unknown>)

const flat = (text: string) => text.replace(/\s+/g, ' ')

describe('invoice-alert e-mail', () => {
  it.each([
    ['issue', 'Faktura nie powstała – zamówienie #1001'],
    ['total', 'Faktura do sprawdzenia – zamówienie #1001'],
    ['ksef', 'Błąd KSeF – faktura do zamówienia #1001'],
    ['email', 'Faktura nie wyszła e-mailem – zamówienie #1001'],
    ['correction', 'Korekta faktury nie powstała – zamówienie #1001'],
  ] as const)('%s → %s', async (kind, subject) => {
    const rendered = await render({ kind })
    expect(rendered.subject).toBe(subject)
    expect(rendered.name).toBe(`invoice-alert-1001-${kind}`)
    expect(flat(rendered.text)).toContain('buyer_tax_no: jest nieprawidłowy')
  })

  it('asks to recheck only for a total difference', async () => {
    const total = flat((await render({ kind: 'total' })).text)
    const issue = flat((await render({ kind: 'issue' })).text)

    expect(total).toContain(
      'Popraw fakturę w Fakturowni i kliknij „Sprawdź ponownie” na karcie Faktura.',
    )
    expect(issue).not.toContain('Sprawdź ponownie')
  })

  it('a correction alert says where to look and promises no schedule (it differs by problem)', async () => {
    const correction = flat((await render({ kind: 'correction' })).text)

    expect(correction).toContain(
      'Sprawdź zwrot w zamówieniu w panelu Medusy i fakturę w Fakturowni. Sklep ponawia, gdy to ma sens; gdy korekta nie powstanie, wystaw ją ręcznie w Fakturowni.',
    )
    // Attention rows are re-checked for 30 days, transient failures retry up to 24 h, permanent
    // and duplicate ones never – so no interval or period is named.
    expect(correction).not.toContain('15 minut')
    expect(correction).not.toContain('30 dni')
    expect(correction).not.toContain('Wystaw ponownie')
  })

  it('links to the order in the admin only when the admin address is known', async () => {
    const withLink = await render({ adminUrl: 'https://api.shop.example/app/orders/order_1' })
    const without = await render()

    expect(withLink.html).toContain('https://api.shop.example/app/orders/order_1')
    expect(flat(without.text)).not.toContain('Otwórz zamówienie w panelu')
    expect(flat(without.text)).toContain('#1001')
  })
})

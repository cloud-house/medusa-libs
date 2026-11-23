import type { InvoiceEmailData } from '../../types'
import { renderInvoiceEmail } from './render'

const data = (over: Partial<InvoiceEmailData> = {}): InvoiceEmailData => ({
  displayId: 1001,
  number: 'FV 12/11/2026',
  total: 2348.4,
  accountUrl: null,
  shopUrl: 'https://shop.example',
  seller: 'Acme Shop sp. z o.o., ul. Morska 5, 80-001 Gdańsk, NIP 5260250274',
  contact: { canReply: true, email: 'sklep@shop.example', phone: null, hours: null },
  ...over,
})

const render = (over: Partial<InvoiceEmailData> = {}) =>
  renderInvoiceEmail('invoice', data(over) as unknown as Record<string, unknown>)

const flat = (text: string) => text.replace(/\s+/g, ' ')

describe('invoice e-mail', () => {
  it('names the invoice, the order and the amount and points to the attachment', async () => {
    const { subject, text, name } = await render()
    const plain = flat(text)

    expect(subject).toBe('Faktura do zamówienia nr 1001')
    expect(name).toBe('invoice-1001')
    expect(plain).toContain('FV 12/11/2026')
    expect(plain).toContain('#1001')
    expect(plain).toContain('2 348,40 zł')
    expect(plain).toContain('Fakturę znajdziesz w załączniku (PDF).')
    expect(plain).toContain('sklep@shop.example')
    expect(plain).not.toContain('Zobacz zamówienie w koncie')
  })

  it('links to the order in the account when the order has one', async () => {
    const { html, text } = await render({
      accountUrl: 'https://shop.example/konto/zamowienia/order_1',
    })

    expect(flat(text)).toContain('Zobacz zamówienie w koncie')
    expect(html).toContain('https://shop.example/konto/zamowienia/order_1')
  })
})

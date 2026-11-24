import type { ReturnAlertEmailData } from '../types'
import { renderReturnEmail } from './render'

const data = (over: Partial<ReturnAlertEmailData> = {}): ReturnAlertEmailData => ({
  displayId: 1001,
  returnNumber: 3,
  orderId: 'order_1',
  email: 'jan@example.pl',
  items: [
    { name: 'Pompka elektryczna 12 V', variant: null, quantity: 2, reason: 'Wada / uszkodzenie' },
    { name: 'Leash spiralny', variant: "10'", quantity: 1, reason: 'Niewłaściwy rozmiar' },
  ],
  note: null,
  adminUrl: null,
  shopUrl: 'https://sklep.test',
  ...over,
})

const render = (over: Partial<ReturnAlertEmailData> = {}) =>
  renderReturnEmail('return-alert', data(over) as unknown as Record<string, unknown>)

const flat = (text: string) => text.replace(/\s+/g, ' ')

describe('return-alert e-mail', () => {
  it('announces the return with the order, the customer and the lines', async () => {
    const { subject, name, html, text } = await render()
    const plain = flat(text)

    expect(subject).toBe('Nowy zwrot – zamówienie #1001')
    expect(name).toBe('return-alert-1001-3')
    expect(html).toContain('Nowy zwrot – zamówienie #1001')
    expect(plain).toContain('Klient zgłosił zwrot nr 3 do zamówienia #1001 (jan@example.pl).')
    expect(plain).toContain('Pompka elektryczna 12 V × 2 – Wada / uszkodzenie')
    // The variant tells the shop which piece comes back.
    expect(plain).toContain("Leash spiralny – 10' × 1 – Niewłaściwy rozmiar")
  })

  it('leaves out the parenthesis without a customer e-mail', async () => {
    const plain = flat((await render({ email: null })).text)

    expect(plain).toContain('Klient zgłosił zwrot nr 3 do zamówienia #1001.')
    expect(plain).not.toContain('()')
  })

  it('leaves out the reason of a line that has none', async () => {
    const plain = flat(
      (
        await render({
          items: [{ name: 'Pompka elektryczna 12 V', variant: null, quantity: 1, reason: null }],
        })
      ).text,
    )

    expect(plain).toContain('Pompka elektryczna 12 V × 1')
    expect(plain).not.toContain('× 1 –')
  })

  it('shows the customer note only when there is one', async () => {
    const without = await render()
    expect(flat(without.text)).not.toContain('Uwagi klienta')

    const withNote = await render({ note: 'Pompka nie trzyma ciśnienia.' })
    expect(flat(withNote.text)).toContain('Uwagi klienta: Pompka nie trzyma ciśnienia.')
  })

  it('keeps the line breaks of the note', async () => {
    const { html } = await render({ note: 'Pierwsza linia\nDruga linia' })

    expect(html).toMatch(/white-space:pre-line[^>]*>Uwagi klienta: /)
  })

  it('says what to do when the parcel arrives', async () => {
    const { text } = await render()

    expect(flat(text)).toContain(
      'Gdy paczka dotrze, przyjmij zwrot w zamówieniu w panelu Medusy – sklep wystawi wtedy korektę faktury. Pieniądze zwróć ręcznie w płatnościach zamówienia (Refund).',
    )
    expect(flat(text)).toContain(
      'Ten mail wysłał sklep Acme Shop na adres kontaktowy z Ustawień sklepu.',
    )
  })

  it('links to the order in the admin only when the admin address is known', async () => {
    const withLink = await render({ adminUrl: 'https://api.chonasupa.pl/app/orders/order_1' })
    const without = await render()

    expect(withLink.html).toContain('https://api.chonasupa.pl/app/orders/order_1')
    expect(flat(withLink.text)).toContain('Otwórz zamówienie w panelu')
    expect(without.html).not.toContain('/app/orders/')
    expect(flat(without.text)).not.toContain('Otwórz zamówienie w panelu')
    expect(flat(without.text)).toContain(
      'Zamówienie #1001 znajdziesz w panelu Medusy (Zamówienia).',
    )
  })

  it('escapes what the customer typed', async () => {
    const { html } = await render({ note: '<script>alert(1)</script>' })

    expect(html).not.toContain('<script>alert')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })
})

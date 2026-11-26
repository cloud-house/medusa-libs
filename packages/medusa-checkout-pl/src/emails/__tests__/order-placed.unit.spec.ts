import { orderPlacedData } from '../demo-order'
import type { OrderPlacedEmailData } from '../types'
import { renderCheckoutEmail } from './render'

const render = (over: Partial<OrderPlacedEmailData> = {}) =>
  renderCheckoutEmail('order-placed', orderPlacedData(over) as unknown as Record<string, unknown>)

/** Plain text collapses whitespace differently per client – compare on single spaces. */
const flat = (text: string) => text.replace(/\s+/g, ' ')

describe('order-placed e-mail', () => {
  it('full order: subject, greeting, items under the board, totals, delivery, invoice, contact, footer', async () => {
    const { subject, html, text, name } = await render()
    const plain = flat(text)

    expect(subject).toBe('Dziękujemy za zamówienie #1001')
    expect(name).toBe('order-placed-1001')
    for (const fragment of [
      'Cześć Jan, przyjęliśmy Twoje zamówienie #1001 z 19 października 2026',
      'Allround Wave',
      `Turkus · 10'6"`,
      'Do zestawu',
      'zamiast Wiosło alu 3-cz.',
      'Rabat zestawowy',
      '449,40 zł',
      '2 348,40 zł',
      'w tym VAT',
      'Dostawa · Kurier InPost',
      'Sup Sp. z o.o.',
      'NIP 5260250274',
      'Odpowiedz na tego maila albo napisz na sklep@shop.example, tel. +48 600 100 200 (pon.–pt. 9–17).',
      'Ten mail wysłaliśmy, bo w sklepie Acme Shop złożono zamówienie z tym adresem e-mail.',
    ]) {
      expect(plain).toContain(flat(fragment))
    }
    expect(html).toContain('https://shop.example/regulamin')
    expect(html).toContain('https://shop.example/polityka-prywatnosci')
    expect(plain).toContain('Polityka prywatności')
    expect(plain).toContain(
      flat('Sprzedawca: Acme Shop sp. z o.o., ul. Morska 5, 80-001 Gdańsk, NIP 5260250274'),
    )
    expect(text).toContain('https://shop.example/polityka-prywatnosci')
    expect(html).toContain('#0e1b2c')
    // No payment status or method (spec 3c); the invoice sentence (6c §5.5) names no status.
    for (const word of ['Opłacone', 'opłacone', 'Status płatności', 'Metoda płatności', 'BLIK']) {
      expect(text).not.toContain(word)
      expect(html).not.toContain(word)
    }
  })

  it('says the invoice comes in a separate e-mail', async () => {
    const { text } = await render({ invoice: null })
    expect(flat(text)).toContain('Fakturę wyślemy w osobnym e-mailu po zaksięgowaniu płatności.')
  })

  it('plain text keeps a space between a sum label and its amount', async () => {
    const plain = flat((await render()).text)

    expect(plain).toMatch(/Wartość produktów\s+2 648 zł/)
    expect(plain).toMatch(/Razem\s+2 348,40 zł/)
    expect(plain).not.toContain('Razem2')
  })

  it('plain text says which amount is the price before the discount', async () => {
    const plain = flat((await render()).text)

    expect(plain).toContain('449,40 zł przed rabatem 749 zł')
  })

  it('product photos are described by the product name, the quantity never wraps', async () => {
    const { html } = await render()

    expect(html).toContain('alt="Allround Wave"')
    expect(html).toContain('alt="Wiosło Carbon Pro"')
    expect(html).toContain('1 szt.')
    expect(html).not.toContain('1 szt.')
  })

  it('no first name, no invoice, no discounts', async () => {
    const { text } = await render({
      firstName: null,
      invoice: null,
      totals: { ...orderPlacedData().totals, discounts: 0 },
    })

    expect(text).toContain('Dzień dobry,')
    expect(text).not.toContain('Dane do faktury')
    expect(text).not.toContain('Rabaty')
  })

  it('parcel locker with the point address and the courier note', async () => {
    const note =
      'Część zamówienia nie zmieści się w paczkomacie – wyślemy ją kurierem pod adres z zamówienia.'
    const { text } = await render({
      delivery: {
        method: 'Paczkomat InPost',
        lines: ['Paczkomat KRA01M', 'ul. Krakowska 1, 30-001 Kraków'],
        note,
      },
    })
    const plain = flat(text)

    expect(plain).toContain('Paczkomat KRA01M')
    expect(plain).toContain('ul. Krakowska 1, 30-001 Kraków')
    expect(plain).toContain(note)
  })

  it('without seller data the footer has no seller line', async () => {
    const { html, text } = await render({ seller: null })
    expect(text).not.toContain('Sprzedawca:')
    expect(html).not.toContain('Sprzedawca:')
  })

  it('contact shows only what is known', async () => {
    const contact = orderPlacedData().contact
    const onlyEmail = flat(
      (await render({ contact: { ...contact, phone: null, hours: null } })).text,
    )
    expect(onlyEmail).toContain('Odpowiedz na tego maila albo napisz na sklep@shop.example.')

    const nothing = (
      await render({
        contact: { canReply: false, email: null, phone: null, hours: null },
      })
    ).text
    expect(nothing).not.toContain('Masz pytania?')

    const phoneOnly = flat(
      (
        await render({
          contact: { canReply: false, email: null, phone: '+48 600 100 200', hours: null },
        })
      ).text,
    )
    expect(phoneOnly).toContain('Napisz do nas: tel. +48 600 100 200.')
    expect(phoneOnly).not.toContain('Odpowiedz na tego maila')
  })

  it('a line without a thumbnail has no empty image', async () => {
    const data = orderPlacedData()
    const group = data.groups[0]
    if (!group) throw new Error('fixture without groups')
    const { html } = await render({
      groups: [{ ...group, line: { ...group.line, thumbnail: null } }],
    })

    expect(html).not.toContain('src=""')
    expect(html).toContain('Allround Wave')
  })

  it('escapes customer data', async () => {
    const { html } = await render({
      invoice: { company: '<b>X</b> & Co', nip: null, lines: [] },
    })

    expect(html).toContain('&lt;b&gt;X&lt;/b&gt; &amp; Co')
    expect(html).not.toContain('<b>X</b>')
  })

  it('an unknown template is an error', async () => {
    await expect(renderCheckoutEmail('nope', {})).rejects.toThrow('Unknown e-mail template: nope')
  })

  it('customer note: own section in HTML and text, none without a note', async () => {
    const withNote = await render({ customerNote: 'Proszę dzwonić przed dostawą' })
    // Plain text writes headings in capitals (like „DOSTAWA”).
    expect(flat(withNote.text)).toContain('UWAGI DO ZAMÓWIENIA Proszę dzwonić przed dostawą')
    expect(withNote.html).toContain('Uwagi do zamówienia')
    expect(withNote.html).toContain('Proszę dzwonić przed dostawą')

    const without = await render({ customerNote: null })
    expect(without.text.toLowerCase()).not.toContain('uwagi do zamówienia')
    expect(without.html).not.toContain('Uwagi do zamówienia')
  })
})

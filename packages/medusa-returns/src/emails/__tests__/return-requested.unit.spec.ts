import type { ReturnRequestedEmailData } from '../types'
import { renderReturnEmail } from './render'

const data = (over: Partial<ReturnRequestedEmailData> = {}): ReturnRequestedEmailData => ({
  displayId: 1001,
  returnNumber: 3,
  items: [
    {
      name: 'Allround Wave',
      variant: 'Turkus · 10\'6"',
      quantity: 1,
      reason: 'Wada / uszkodzenie',
    },
    { name: 'Pompka elektryczna 12 V', variant: null, quantity: 2, reason: null },
  ],
  address: ['Acme Shop – zwroty', 'ul. Portowa 3', '80-002 Gdańsk'],
  labelUrl: 'https://sklep.test/zwrot/etykieta?zamowienie=1001',
  accountUrl: null,
  shopUrl: 'https://sklep.test',
  contact: { canReply: true, email: 'sklep@shop.example', phone: null, hours: null },
  seller: null,
  shippingHint: 'Deskę SUP trzeba odesłać kurierem, akcesoria możesz nadać też w paczkomacie.',
  packingHint:
    'Deskę zapakuj najlepiej w oryginalny plecak lub karton, z wiosłem i akcesoriami z zestawu.',
  ...over,
})

const render = (over: Partial<ReturnRequestedEmailData> = {}) =>
  renderReturnEmail('return-requested', data(over) as unknown as Record<string, unknown>)

const flat = (text: string) => text.replace(/\s+/g, ' ')

describe('return-requested e-mail', () => {
  it('confirms the request with the subject, the numbers and the lines', async () => {
    const { subject, name, html, text } = await render()
    const plain = flat(text)

    expect(subject).toBe('Zgłoszenie zwrotu do zamówienia #1001')
    expect(name).toBe('return-requested-1001-3')
    expect(html).toContain('Mamy Twoje zgłoszenie zwrotu')
    expect(plain).toContain(
      'Otrzymaliśmy Twoje oświadczenie o odstąpieniu od umowy dla zamówienia nr 1001 (zgłoszenie nr 3).',
    )
    expect(html).toContain('Co zwracasz')
    expect(plain).toContain('Allround Wave – Turkus · 10\'6" × 1')
    // No variant: no dash.
    expect(plain).toContain('Pompka elektryczna 12 V × 2')
    expect(plain).not.toContain('Pompka elektryczna 12 V – ')
  })

  it('says how to send the goods back and who pays', async () => {
    const { html, text } = await render()
    const plain = flat(text)

    expect(html).toContain('Jak odesłać towar')
    expect(plain).toContain('Odeślij towar w ciągu 14 dni od zgłoszenia na adres:')
    expect(plain).toContain('Acme Shop – zwroty')
    expect(plain).toContain('ul. Portowa 3')
    expect(plain).toContain('80-002 Gdańsk')
    expect(plain).toContain('Bezpośredni koszt odesłania Towaru ponosi Kupujący.')
    expect(plain).toContain(
      'Deskę SUP trzeba odesłać kurierem, akcesoria możesz nadać też w paczkomacie.',
    )
    expect(plain).toContain(
      'Deskę zapakuj najlepiej w oryginalny plecak lub karton, z wiosłem i akcesoriami z zestawu.',
    )
    expect(plain).not.toContain('Napisz do nas przed wysłaniem paczki')
  })

  it('links the address label page', async () => {
    const { html, text } = await render()

    expect(html).toContain('href="https://sklep.test/zwrot/etykieta?zamowienie=1001"')
    expect(flat(text)).toContain('Wydrukuj etykietę adresową')
    expect(text).toContain('https://sklep.test/zwrot/etykieta?zamowienie=1001')
  })

  it('states the refund the way the terms do, not from the delivery of the parcel', async () => {
    const { html, text } = await render()
    const plain = flat(text)

    expect(html).toContain('Zwrot pieniędzy')
    expect(plain).toContain(
      'Pieniądze oddamy niezwłocznie, nie później niż w ciągu 14 dni od otrzymania Twojego oświadczenia, tą samą metodą płatności.',
    )
    expect(plain).toContain(
      'Możemy wstrzymać zwrot do czasu otrzymania towaru albo dowodu jego odesłania.',
    )
    // Zwracamy dostawę w kwocie zapłaconej (decyzja właściciela 2026-11-09), bez limitu §8.
    expect(plain).toContain('Przy zwrocie całego zamówienia oddamy też koszt dostawy do Ciebie.')
    expect(plain).not.toContain('najtańszego zwykłego sposobu')
    expect(html).not.toContain('najtańszego zwykłego sposobu')
    expect(plain).not.toContain('od doręczenia paczki')
    expect(html).not.toContain('od doręczenia paczki')
  })

  it('asks to write first while the return address is unknown', async () => {
    const { text, html } = await render({ address: null })
    const plain = flat(text)

    expect(plain).toContain('Napisz do nas przed wysłaniem paczki – podamy adres do zwrotu.')
    expect(plain).not.toContain('Odeślij towar w ciągu 14 dni od zgłoszenia na adres:')
    expect(plain).not.toContain('ul. Portowa 3')
    // The rest of the instructions stay, the label does not: its page would only say to write.
    expect(plain).toContain('Bezpośredni koszt odesłania Towaru ponosi Kupujący.')
    expect(plain).not.toContain('Wydrukuj etykietę adresową')
    expect(html).not.toContain('/zwrot/etykieta')
  })

  it('has the account button only with the account link', async () => {
    const without = await render()
    expect(flat(without.text)).not.toContain('Zobacz zamówienie w koncie')

    const withLink = await render({ accountUrl: 'https://sklep.test/konto/zamowienia/order_1' })
    expect(flat(withLink.text)).toContain('Zobacz zamówienie w koncie')
    expect(withLink.html).toContain('https://sklep.test/konto/zamowienia/order_1')
  })

  it('shows the shop contact, and none without one', async () => {
    expect((await render()).text).toContain('sklep@shop.example')

    const { text } = await render({ contact: null })
    expect(flat(text)).not.toContain('Masz pytania?')
  })

  it('escapes what the customer or the CMS typed', async () => {
    const { html } = await render({
      items: [{ name: '<img src=x onerror=alert(1)>', variant: null, quantity: 1, reason: null }],
      address: ['<script>alert(1)</script>'],
    })

    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('<script>alert')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('without the shop copy there is no board-specific advice', async () => {
    const { text } = await render({ shippingHint: null, packingHint: null })
    const plain = flat(text)

    expect(plain).toContain('Bezpośredni koszt odesłania Towaru ponosi Kupujący.')
    expect(plain).not.toContain('Deskę')
    expect(plain).not.toContain('paczkomacie')
  })
})

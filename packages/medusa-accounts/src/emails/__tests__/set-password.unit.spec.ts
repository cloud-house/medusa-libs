import type { AccountEmailData } from '../types'
import { flat, renderAccountEmail } from './render'

const data = (over: Partial<AccountEmailData> = {}): AccountEmailData => ({
  email: 'anna@example.com',
  firstName: 'Anna',
  actionUrl: 'https://shop.example/ustaw-haslo?kod=abc_DEF',
  contact: { canReply: true, email: 'shop@shop.example', phone: null, hours: null },
  seller: null,
  shopUrl: 'https://shop.example',
  orderNumber: 1042,
  ...over,
})

const render = (over: Partial<AccountEmailData> = {}) =>
  renderAccountEmail('set-password', data(over) as unknown as Record<string, unknown>)

describe('set-password e-mail', () => {
  it('temat, numer zamówienia, link i 7 dni', async () => {
    const { subject, html, text, name } = await render()
    expect(subject).toBe('Ustaw hasło do konta Acme Shop')
    expect(name).toBe('set-password-anna@example.com')
    expect(html).toContain('https://shop.example/ustaw-haslo?kod=abc_DEF')
    expect(text).toContain('https://shop.example/ustaw-haslo?kod=abc_DEF')
    expect(flat(text)).toContain('Zamówienie #1042 jest już w Twoim koncie.')
    expect(flat(text)).toContain('Link jest ważny 7 dni. Jeśli to nie Ty, zignoruj tę wiadomość.')
    expect(flat(text)).toContain('Ustaw hasło')
  })

  it('bez numeru zamówienia – konto czeka na hasło', async () => {
    const { text } = await render({ orderNumber: null })
    expect(flat(text)).toContain('Twoje konto w Acme Shopie czeka na hasło.')
    expect(text).not.toContain('Zamówienie #')
  })
})

import type { AccountEmailData } from '../types'
import { flat, renderAccountEmail } from './render'

const data = (over: Partial<AccountEmailData> = {}): AccountEmailData => ({
  email: 'anna@example.com',
  firstName: 'Anna',
  actionUrl: 'https://shop.example/potwierdz-email?kod=abc_DEF-123',
  contact: { canReply: true, email: 'shop@shop.example', phone: null, hours: null },
  seller: null,
  shopUrl: 'https://shop.example',
  ...over,
})

const render = (over: Partial<AccountEmailData> = {}) =>
  renderAccountEmail('email-confirmation', data(over) as unknown as Record<string, unknown>)

describe('email-confirmation e-mail', () => {
  it('temat, powitanie, link potwierdzający i ważność', async () => {
    const { subject, html, text, name } = await render()

    expect(subject).toBe('Potwierdź adres e-mail w Acme Shopie')
    expect(name).toBe('email-confirmation-anna@example.com')
    expect(html).toContain('https://shop.example/potwierdz-email?kod=abc_DEF-123')
    expect(text).toContain('https://shop.example/potwierdz-email?kod=abc_DEF-123')
    expect(flat(text)).toContain('Cześć, Anna!')
    expect(flat(text)).toContain('Link jest ważny 7 dni.')
    expect(html).toContain('https://shop.example/terms')
    expect(html).toContain('#0e1b2c')
  })

  it('bez imienia – samo „Cześć!”', async () => {
    const { text } = await render({ firstName: null })
    expect(flat(text)).toContain('Cześć!')
    expect(text).not.toContain('Cześć, ')
  })
})

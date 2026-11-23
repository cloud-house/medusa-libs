import type { AccountEmailData } from '../types'
import { flat, renderAccountEmail } from './render'

const data: AccountEmailData = {
  email: 'anna@example.com',
  firstName: 'Anna',
  actionUrl: 'https://shop.example/nowe-haslo?token=eyJ.abc.def',
  contact: { canReply: false, email: 'shop@shop.example', phone: null, hours: null },
  seller: null,
  shopUrl: 'https://shop.example',
}

describe('password-reset e-mail', () => {
  it('temat, link do nowego hasła i 15 minut ważności', async () => {
    const { subject, html, text, name } = await renderAccountEmail(
      'password-reset',
      data as unknown as Record<string, unknown>,
    )

    expect(subject).toBe('Ustaw nowe hasło w Acme Shopie')
    expect(name).toBe('password-reset-anna@example.com')
    expect(html).toContain('https://shop.example/nowe-haslo?token=eyJ.abc.def')
    expect(text).toContain('https://shop.example/nowe-haslo?token=eyJ.abc.def')
    expect(flat(text)).toContain('Ustaw nowe hasło')
    expect(flat(text)).toContain(
      'Link jest ważny 15 minut. Jeśli to nie Ty, zignoruj tę wiadomość.',
    )
    expect(flat(text)).toContain('Cześć, Anna!')
  })
})

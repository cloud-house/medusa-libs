import { ACCOUNT_ERROR_CODES } from '../errors'
import { messages, resolveMessages } from '../messages'

describe('messages', () => {
  it('pl dictionary equals the legacy texts', () => {
    expect(messages.pl).toEqual({
      duplicateAccount: 'Konto z tym adresem już istnieje.',
      linkExpired: 'Link wygasł albo został już użyty.',
      tooManyRequests: 'Za dużo prób. Spróbuj ponownie za kilka minut.',
      wrongCurrentPassword: 'Obecne hasło jest nieprawidłowe.',
      wrongPassword: 'Nieprawidłowe hasło.',
      signInAgain: 'Zaloguj się ponownie.',
      tokenIssuedAtMissing: 'Brak czasu wydania tokenu.',
      orderNotFound: 'Nie znaleziono zamówienia.',
      cartNotFound: 'Nie znaleziono koszyka.',
      invoiceNotFound: 'Nie znaleziono faktury.',
      sessionExpired: 'Sesja wygasła. Zaloguj się ponownie.',
      notFound: 'Nie znaleziono.',
      metadataUnavailable: 'Pole metadata jest niedostępne.',
    })
  })

  it('en has the same keys as pl and no empty text', () => {
    expect(Object.keys(messages.en).sort()).toEqual(Object.keys(messages.pl).sort())
    for (const text of Object.values(messages.en)) expect(text.length).toBeGreaterThan(0)
  })

  it('resolveMessages ignores undefined overrides', () => {
    const resolved = resolveMessages('en', { linkExpired: undefined, cartNotFound: 'No cart.' })
    expect(resolved.linkExpired).toBe(messages.en.linkExpired)
    expect(resolved.cartNotFound).toBe('No cart.')
  })

  it('has one account_* error code per message', () => {
    expect(Object.keys(ACCOUNT_ERROR_CODES).sort()).toEqual(Object.keys(messages.pl).sort())
    for (const code of Object.values(ACCOUNT_ERROR_CODES)) expect(code).toMatch(/^account_[a-z_]+$/)
    expect(new Set(Object.values(ACCOUNT_ERROR_CODES)).size).toBe(
      Object.keys(ACCOUNT_ERROR_CODES).length,
    )
  })
})

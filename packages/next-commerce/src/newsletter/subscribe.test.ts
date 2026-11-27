import { describe, expect, it, vi } from 'vitest'

const NEWSLETTER_CONSENT_TEXT =
  'Chcę otrzymywać newsletter sklepu. Szczegóły w polityce prywatności.'

import { NEWSLETTER_MESSAGES, redactedError, type SubscribeDeps, subscribe } from './subscribe'

const NOW = new Date('2026-10-21T10:00:00.000Z')

function fakeDeps(overrides: Partial<SubscribeDeps> = {}) {
  const deps = {
    exists: vi.fn(async () => false),
    create: vi.fn(async () => {}),
    notify: vi.fn(async () => {}),
    isUniqueViolation: vi.fn(() => false),
    allow: vi.fn(() => true),
    now: () => NOW,
    log: vi.fn(),
    consentText: NEWSLETTER_CONSENT_TEXT,
    logPrefix: '[ChoNaSupa]',
    ...overrides,
  }
  return deps
}

const form = (extra: Record<string, unknown> = {}) => ({
  email: ' Ola@Example.PL ',
  consent: 'tak',
  website: '',
  source: 'home',
  ...extra,
})

describe('subscribe', () => {
  it('zapisuje znormalizowany adres z treścią zgody, datą i źródłem', async () => {
    const deps = fakeDeps()
    expect(await subscribe(form(), '5.6.7.8', deps)).toEqual({
      status: 'success',
      email: 'ola@example.pl',
    })
    expect(deps.create).toHaveBeenCalledWith({
      email: 'ola@example.pl',
      consentText: NEWSLETTER_CONSENT_TEXT,
      consentAt: NOW.toISOString(),
      source: 'home',
    })
    expect(deps.notify).toHaveBeenCalledWith('ola@example.pl')
  })

  it('błąd notify nie blokuje podziękowania', async () => {
    const deps = fakeDeps({
      notify: vi.fn(async () => {
        throw new Error('Resend down')
      }),
    })
    expect(await subscribe(form(), null, deps)).toEqual({
      status: 'success',
      email: 'ola@example.pl',
    })
    expect(deps.create).toHaveBeenCalled()
  })

  it('gdy adres już istnieje, notify nie jest wywoływane', async () => {
    const deps = fakeDeps({ exists: vi.fn(async () => true) })
    await subscribe(form(), null, deps)
    expect(deps.notify).not.toHaveBeenCalled()
  })

  it('gdy create rzuca, notify nie jest wywoływane', async () => {
    const deps = fakeDeps({
      create: vi.fn(async () => {
        throw new Error('DB error')
      }),
    })
    await subscribe(form(), null, deps)
    expect(deps.notify).not.toHaveBeenCalled()
  })

  it('zapisany już adres: to samo podziękowanie bez drugiego wpisu', async () => {
    const deps = fakeDeps({ exists: vi.fn(async () => true) })
    expect(await subscribe(form(), null, deps)).toEqual({
      status: 'success',
      email: 'ola@example.pl',
    })
    expect(deps.create).not.toHaveBeenCalled()
  })

  it('wyścig na unikalnym e-mailu kończy się podziękowaniem', async () => {
    const deps = fakeDeps({
      create: vi.fn(async () => {
        throw new Error('duplicate')
      }),
      isUniqueViolation: vi.fn(() => true),
    })
    expect(await subscribe(form(), null, deps)).toEqual({
      status: 'success',
      email: 'ola@example.pl',
    })
    expect(deps.log).not.toHaveBeenCalled()
  })

  it('inny błąd zapisu: komunikat ogólny i wpis w logu', async () => {
    const error = new Error('db down')
    const deps = fakeDeps({
      create: vi.fn(async () => {
        throw error
      }),
    })
    expect(await subscribe(form(), null, deps)).toEqual({
      status: 'error',
      email: ' Ola@Example.PL ',
      fieldErrors: {},
      message: NEWSLETTER_MESSAGES.failed,
    })
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining('db down'))
  })

  it('wpis w logu bez adresu e-mail – drizzle podaje go w treści błędu i w przyczynie', async () => {
    const error = new Error(
      'Failed query: insert into "newsletter_subscribers" ("email", "consent_text") values ($1, $2)\nparams: ola@example.pl,Chcę otrzymywać newsletter',
      {
        cause: Object.assign(new Error('Key (email)=(ola@example.pl) already exists.'), {
          code: '23505',
        }),
      },
    )
    const deps = fakeDeps({
      create: vi.fn(async () => {
        throw error
      }),
    })
    await subscribe(form(), null, deps)
    const logged = JSON.stringify(vi.mocked(deps.log).mock.calls)
    expect(logged).not.toMatch(/ola@example\.pl/i)
    expect(logged).toContain('Failed query: insert into')
    expect(logged).toContain('23505')
  })

  it('redactedError: adres z apostrofem też zamaskowany, dziwny błąd nie wywraca zapisu', () => {
    expect(redactedError(new Error("params: jan.o'brien@example.pl,Zgoda"))).not.toMatch(/brien/)
    expect(redactedError(Object.create(null))).toBe('[nieznany błąd]')
  })

  it('wypełnione pole-pułapka: udany wynik bez zapisu', async () => {
    const deps = fakeDeps()
    expect((await subscribe(form({ website: 'https://spam.example' }), null, deps)).status).toBe(
      'success',
    )
    expect(deps.exists).not.toHaveBeenCalled()
    expect(deps.create).not.toHaveBeenCalled()
  })

  it('limit prób: komunikat i brak zapisu; bez adresu IP limit nie działa', async () => {
    const limited = fakeDeps({ allow: vi.fn(() => false) })
    expect(await subscribe(form(), '5.6.7.8', limited)).toEqual({
      status: 'error',
      email: ' Ola@Example.PL ',
      fieldErrors: {},
      message: NEWSLETTER_MESSAGES.rateLimited,
    })
    expect(limited.create).not.toHaveBeenCalled()
    const local = fakeDeps({ allow: vi.fn(() => false) })
    expect((await subscribe(form(), null, local)).status).toBe('success')
    expect(local.allow).not.toHaveBeenCalled()
  })

  it('zły e-mail i brak zgody: oba błędy naraz, wpisany tekst zostaje', async () => {
    const deps = fakeDeps()
    expect(await subscribe(form({ email: 'ola@', consent: null }), null, deps)).toEqual({
      status: 'error',
      email: 'ola@',
      fieldErrors: { email: NEWSLETTER_MESSAGES.email, consent: NEWSLETTER_MESSAGES.consent },
    })
    expect(deps.create).not.toHaveBeenCalled()
  })

  it('nieznane źródło zapisuje jako stopkę', async () => {
    const deps = fakeDeps()
    await subscribe(form({ source: 'x' }), null, deps)
    expect(deps.create).toHaveBeenCalledWith(expect.objectContaining({ source: 'footer' }))
  })

  it('zapis przy rejestracji zachowuje źródło „register”', async () => {
    const deps = fakeDeps()
    await subscribe(form({ source: 'register' }), null, deps)
    expect(deps.create).toHaveBeenCalledWith(expect.objectContaining({ source: 'register' }))
  })

  it('zapis w kasie zachowuje źródło „checkout”', async () => {
    const deps = fakeDeps()
    await subscribe(form({ source: 'checkout' }), null, deps)
    expect(deps.create).toHaveBeenCalledWith(expect.objectContaining({ source: 'checkout' }))
  })

  it('komunikaty po polsku', () => {
    expect(NEWSLETTER_MESSAGES).toEqual({
      email: 'Podaj poprawny adres e-mail.',
      consent: 'Zaznacz zgodę, żeby się zapisać.',
      rateLimited: 'Za dużo prób. Spróbuj ponownie za kilka minut.',
      failed: 'Nie udało się zapisać. Spróbuj ponownie za chwilę.',
    })
  })
})

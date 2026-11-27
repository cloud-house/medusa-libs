import { describe, expect, it } from 'vitest'
import { validateAddressForm, validateProfileForm, validateRegistration } from './forms'

const form = (entries: Record<string, string>) => {
  const data = new FormData()
  for (const [key, value] of Object.entries(entries)) data.set(key, value)
  return data
}

describe('validateRegistration', () => {
  it('puste pola – błędy przy każdym polu, hasło nie wraca w values', () => {
    const result = validateRegistration(form({ password: 'abc' }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.fieldErrors).toEqual({
      firstName: 'Podaj imię.',
      lastName: 'Podaj nazwisko.',
      email: 'Podaj adres e-mail.',
      phone: 'Podaj numer telefonu.',
      password: 'Hasło musi mieć co najmniej 8 znaków.',
      terms: 'Zaakceptuj regulamin, żeby założyć konto.',
    })
    expect(result.values).not.toHaveProperty('password')
  })

  it('zły e-mail i telefon – czytelne komunikaty, wpisane wartości wracają', () => {
    const result = validateRegistration(
      form({
        firstName: 'Anna',
        lastName: 'Nowak',
        email: 'anna@',
        phone: '123',
        password: 'tajne-haslo',
        terms: 'tak',
      }),
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.fieldErrors).toEqual({
      email: 'Sprawdź adres e-mail.',
      phone: 'Podaj polski numer telefonu (9 cyfr).',
    })
    expect(result.values).toMatchObject({
      firstName: 'Anna',
      email: 'anna@',
      phone: '123',
      terms: 'tak',
    })
  })

  it('poprawne dane – e-mail małymi literami, telefon +48, newsletter', () => {
    const result = validateRegistration(
      form({
        firstName: ' Anna ',
        lastName: 'Nowak',
        email: 'Anna@Example.com',
        phone: '600 100 200',
        password: 'tajne-haslo',
        terms: 'tak',
        newsletter: 'tak',
      }),
    )
    expect(result).toEqual({
      ok: true,
      value: {
        firstName: 'Anna',
        lastName: 'Nowak',
        email: 'anna@example.com',
        phone: '+48600100200',
        password: 'tajne-haslo',
        newsletter: true,
      },
    })
  })
})

describe('validateAddressForm', () => {
  const address = {
    firstName: 'Anna',
    lastName: 'Nowak',
    address1: 'ul. Morska 12/4',
    postalCode: '80001',
    city: 'Gdańsk',
  }

  it('zły kod, zły NIP, NIP bez firmy', () => {
    const bad = validateAddressForm(form({ ...address, postalCode: '8000', nip: '1234567890' }))
    expect(bad.ok).toBe(false)
    if (bad.ok) return
    expect(bad.fieldErrors).toEqual({
      postalCode: 'Kod pocztowy w formacie 00-000.',
      nip: 'Sprawdź NIP – suma kontrolna się nie zgadza.',
      company: 'Podaj nazwę firmy.',
    })
  })

  it('brak wymaganych pól', () => {
    const empty = validateAddressForm(form({}))
    expect(empty.ok).toBe(false)
    if (empty.ok) return
    expect(Object.keys(empty.fieldErrors).sort()).toEqual(
      ['address1', 'city', 'firstName', 'lastName', 'postalCode'].sort(),
    )
    expect(empty.fieldErrors.city).toBe('Uzupełnij to pole.')
  })

  it('poprawny adres firmowy → body Medusy', () => {
    const ok = validateAddressForm(
      form({
        ...address,
        addressName: 'Biuro',
        company: 'Sup Sp. z o.o.',
        nip: '123-456-32-18',
        defaultBilling: 'tak',
      }),
    )
    expect(ok).toEqual({
      ok: true,
      value: {
        address_name: 'Biuro',
        first_name: 'Anna',
        last_name: 'Nowak',
        address_1: 'ul. Morska 12/4',
        postal_code: '80-001',
        city: 'Gdańsk',
        country_code: 'pl',
        company: 'Sup Sp. z o.o.',
        metadata: { nip: '1234563218' },
        is_default_shipping: false,
        is_default_billing: true,
      },
    })
  })
})

describe('validateProfileForm', () => {
  it('imię, nazwisko i telefon', () => {
    expect(
      validateProfileForm(form({ firstName: 'Anna', lastName: 'Nowak', phone: '600100200' })),
    ).toEqual({
      ok: true,
      value: { first_name: 'Anna', last_name: 'Nowak', phone: '+48600100200' },
    })
    const bad = validateProfileForm(form({ firstName: '', lastName: 'Nowak', phone: '' }))
    expect(bad.ok).toBe(false)
  })
})

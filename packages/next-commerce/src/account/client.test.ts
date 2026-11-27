import { describe, expect, it } from 'vitest'
import { fakeClient, httpError } from '../cart/fake-client'
import {
  attachCart,
  changePassword,
  confirmEmail,
  deleteAccount,
  invoicePdf,
  login,
  orders,
  profile,
  register,
  requestPasswordReset,
  resendConfirmation,
  SessionExpiredError,
  setPasswordFromLink,
  toSavedAddress,
  withToken,
} from './client'

const PROFILE = {
  id: 'cus_1',
  email: 'anna@example.com',
  first_name: 'Anna',
  last_name: 'Nowak',
  phone: '+48600100200',
  email_confirmed: false,
}

describe('login', () => {
  it('wysyła e-mail po normalizacji i zwraca token', async () => {
    const { client, calls } = fakeClient({ 'POST /auth/customer/emailpass': { token: 'jwt-1' } })
    expect(await login(client, '  Anna@Example.COM ', 'tajne-haslo')).toBe('jwt-1')
    expect(calls[0]?.init?.body).toEqual({ email: 'anna@example.com', password: 'tajne-haslo' })
    expect(calls[0]?.init?.cache).toBe('no-store')
  })

  it('401 – null, zły e-mail – null bez zapytania', async () => {
    const { client, calls } = fakeClient({
      'POST /auth/customer/emailpass': () => {
        throw httpError(401, 'Invalid email or password')
      },
    })
    expect(await login(client, 'anna@example.com', 'x')).toBeNull()
    expect(await login(client, 'nie-email', 'x')).toBeNull()
    expect(calls).toHaveLength(1)
  })
})

describe('profile', () => {
  it('wysyła token i no-store', async () => {
    const { client, calls } = fakeClient({
      'GET /store/account/profile': { customer: PROFILE },
    })
    expect(await profile(client, 'jwt-1')).toEqual(PROFILE)
    expect(calls[0]?.init?.headers).toEqual({ authorization: 'Bearer jwt-1' })
    expect(calls[0]?.init?.cache).toBe('no-store')
  })

  it('401 – null (sesja wygasła albo konto usunięte)', async () => {
    const { client } = fakeClient({
      'GET /store/account/profile': () => {
        throw httpError(401, 'Sesja wygasła. Zaloguj się ponownie.')
      },
    })
    expect(await profile(client, 'jwt-1')).toBeNull()
  })
})

describe('trasy konta', () => {
  it('rejestracja: 422 – duplicate', async () => {
    const ok = fakeClient({ 'POST /store/account/register': { customer: { id: 'cus_1' } } })
    const input = {
      email: 'Anna@example.com',
      password: 'tajne-haslo',
      firstName: 'Anna',
      lastName: 'Nowak',
      phone: '+48600100200',
    }
    expect(await register(ok.client, input)).toBe('ok')
    expect(ok.calls[0]?.init?.body).toEqual({
      email: 'anna@example.com',
      password: 'tajne-haslo',
      first_name: 'Anna',
      last_name: 'Nowak',
      phone: '+48600100200',
    })
    const taken = fakeClient({
      'POST /store/account/register': () => {
        throw httpError(422, 'Konto z tym adresem już istnieje.')
      },
    })
    expect(await register(taken.client, input)).toBe('duplicate')
  })

  it('zmiana hasła i usunięcie: 400 – wrong-password', async () => {
    const wrong = () => {
      throw httpError(400, 'Obecne hasło jest nieprawidłowe.')
    }
    const { client } = fakeClient({
      'POST /store/account/password': wrong,
      'POST /store/account/delete': wrong,
    })
    expect(await changePassword(client, 'jwt', 'a', 'b')).toBe('wrong-password')
    expect(await deleteAccount(client, 'jwt', 'a')).toBe('wrong-password')
  })

  it('401 na trasie konta – SessionExpiredError', async () => {
    const { client } = fakeClient({
      'GET /store/account/orders': () => {
        throw httpError(401, 'Sesja wygasła. Zaloguj się ponownie.')
      },
    })
    await expect(orders(client, 'jwt')).rejects.toBeInstanceOf(SessionExpiredError)
  })

  it('potwierdzenie e-maila: z tokenem konta; 400 – null', async () => {
    const ok = fakeClient({ 'POST /store/account/confirm-email': { linked: 2 } })
    expect(await confirmEmail(ok.client, 'jwt-1', 'kod')).toEqual({ linked: 2 })
    expect(ok.calls[0]?.init?.headers).toEqual({ authorization: 'Bearer jwt-1' })
    expect(ok.calls[0]?.init?.body).toEqual({ code: 'kod' })
    const { client } = fakeClient({
      'POST /store/account/confirm-email': () => {
        throw httpError(400, 'Link wygasł albo został już użyty.')
      },
    })
    expect(await confirmEmail(client, 'jwt-1', 'kod')).toBeNull()
  })

  it('„Ustaw hasło” z linku: bez tokenu, 200 – e-mail i dołączone; 400 – null', async () => {
    const ok = fakeClient({
      'POST /store/account/set-password': { email: 'anna@example.com', linked: 1 },
    })
    expect(await setPasswordFromLink(ok.client, 'kod-1', 'Nowe-haslo-1')).toEqual({
      email: 'anna@example.com',
      linked: 1,
    })
    expect(ok.calls[0]?.init?.body).toEqual({ code: 'kod-1', password: 'Nowe-haslo-1' })
    expect(ok.calls[0]?.init?.headers).toBeUndefined()
    const { client } = fakeClient({
      'POST /store/account/set-password': () => {
        throw httpError(400, 'Link wygasł albo został już użyty.')
      },
    })
    expect(await setPasswordFromLink(client, 'kod-1', 'Nowe-haslo-1')).toBeNull()
  })

  it('prośba o nowe hasło – odpowiedź 201 „Created” to tekst, nie JSON', async () => {
    const { client, calls } = fakeClient({ 'POST /auth/customer/emailpass/reset-password': {} })
    await requestPasswordReset(client, ' Anna@Example.com ')
    expect(calls[0]?.init?.body).toEqual({ identifier: 'anna@example.com' })
    expect(calls[0]?.init?.headers).toEqual({ accept: 'text/plain' })
  })

  it('ponowny link: 429 – throttled', async () => {
    const { client } = fakeClient({
      'POST /store/account/email-confirmation': () => {
        throw httpError(429, 'Za dużo prób. Spróbuj ponownie za kilka minut.')
      },
    })
    expect(await resendConfirmation(client, 'jwt')).toBe('throttled')
  })

  it('przypięcie koszyka: 404 – false', async () => {
    const { client } = fakeClient({
      'POST /store/account/cart': () => {
        throw httpError(404, 'Nie znaleziono koszyka.')
      },
    })
    expect(await attachCart(client, 'jwt', 'cart_1')).toBe(false)
  })
})

describe('faktura zamówienia', () => {
  it('PDF: token, accept application/pdf i surowa odpowiedź', async () => {
    const pdf = new Response('%PDF-1.4', { headers: { 'content-type': 'application/pdf' } })
    const { client, calls } = fakeClient({ 'GET /store/account/orders/order_1/invoice': pdf })

    expect(await invoicePdf(client, 'jwt', 'order_1')).toBe(pdf)
    expect(calls[0]?.init).toMatchObject({
      headers: { authorization: 'Bearer jwt', accept: 'application/pdf' },
      cache: 'no-store',
    })
  })

  it('404 – null, 401 – SessionExpiredError', async () => {
    const missing = fakeClient({
      'GET /store/account/orders/order_1/invoice': () => {
        throw httpError(404, 'Nie znaleziono faktury.')
      },
    })
    expect(await invoicePdf(missing.client, 'jwt', 'order_1')).toBeNull()
    const expired = fakeClient({
      'GET /store/account/orders/order_1/invoice': () => {
        throw httpError(401, 'Sesja wygasła.')
      },
    })
    await expect(invoicePdf(expired.client, 'jwt', 'order_1')).rejects.toBeInstanceOf(
      SessionExpiredError,
    )
  })

  it('withToken zostawia własne nagłówki i dokłada token', async () => {
    const { client, calls } = fakeClient({ 'GET /store/account/x': {} })
    await withToken(client, 'jwt', '/store/account/x', { headers: { accept: 'text/plain' } })
    expect(calls[0]?.init?.headers).toEqual({ accept: 'text/plain', authorization: 'Bearer jwt' })
  })
})

describe('toSavedAddress', () => {
  it('adres Medusy → adres konta z NIP-em z metadanych', () => {
    expect(
      toSavedAddress({
        id: 'cuaddr_1',
        address_name: 'Firma',
        first_name: 'Anna',
        last_name: 'Nowak',
        address_1: 'ul. Morska 12/4',
        postal_code: '80-001',
        city: 'Gdańsk',
        company: 'Sup Sp. z o.o.',
        metadata: { nip: '1234563218' },
        is_default_shipping: false,
        is_default_billing: true,
      }),
    ).toEqual({
      id: 'cuaddr_1',
      name: 'Firma',
      fields: {
        firstName: 'Anna',
        lastName: 'Nowak',
        address1: 'ul. Morska 12/4',
        postalCode: '80-001',
        city: 'Gdańsk',
      },
      company: 'Sup Sp. z o.o.',
      nip: '1234563218',
      defaultShipping: false,
      defaultBilling: true,
    })
  })
})

describe('withToken – Review Focus 6c', () => {
  it('inny błąd niż 401 przechodzi dalej bez zmian', async () => {
    const failure = httpError(500, 'Boom')
    const { client } = fakeClient({
      'GET /store/account/x': () => {
        throw failure
      },
    })
    await expect(withToken(client, 'jwt', '/store/account/x')).rejects.toBe(failure)
  })
})

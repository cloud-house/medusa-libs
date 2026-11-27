import { MOBILE_FOR_LOCKER } from '@cloud-house/commerce-rules'
import { describe, expect, it } from 'vitest'
import {
  type CartUpdate,
  type CheckoutForm,
  emptyCheckoutForm,
  formFromCart,
  MAX_CUSTOMER_NOTE,
  normalizePhone,
  normalizePostalCode,
  parseCheckoutForm,
  toCartUpdate,
  validateCheckout,
} from './form'

const address = {
  firstName: 'Jan',
  lastName: 'Kowalski',
  address1: 'ul. Morska 5',
  postalCode: '80-001',
  city: 'Gdańsk',
}

function validForm(overrides: Partial<CheckoutForm> = {}): CheckoutForm {
  return {
    ...emptyCheckoutForm(),
    email: 'jan@example.pl',
    phone: '600 100 200',
    shipping: { ...address },
    deliveryOptionId: 'so_dpd',
    deliveryCode: 'kurier-dpd',
    blikCode: '123456',
    terms: true,
    ...overrides,
  }
}

describe('validateCheckout', () => {
  it('a complete form has no errors; BLIK is the default payment', () => {
    expect(emptyCheckoutForm().payment).toBe('blik')
    expect(validateCheckout(validForm())).toEqual({})
  })

  it('an empty form names every required field', () => {
    expect(validateCheckout(emptyCheckoutForm())).toEqual({
      email: 'Podaj adres e-mail.',
      phone: 'Podaj numer telefonu.',
      'shipping.firstName': 'Uzupełnij to pole.',
      'shipping.lastName': 'Uzupełnij to pole.',
      'shipping.address1': 'Uzupełnij to pole.',
      'shipping.postalCode': 'Uzupełnij to pole.',
      'shipping.city': 'Uzupełnij to pole.',
      delivery: 'Wybierz sposób dostawy.',
      blikCode: 'Kod BLIK ma 6 cyfr.',
      terms: 'Zaakceptuj regulamin, żeby złożyć zamówienie.',
    })
  })

  it('checks the format of e-mail, phone and postal code', () => {
    expect(
      validateCheckout(
        validForm({
          email: 'jan@example',
          phone: '600 100',
          shipping: { ...address, postalCode: '8-0001' },
        }),
      ),
    ).toEqual({
      email: 'Sprawdź adres e-mail.',
      phone: 'Podaj polski numer telefonu (9 cyfr).',
      'shipping.postalCode': 'Kod pocztowy w formacie 00-000.',
    })
    expect(validateCheckout(validForm({ phone: '+48 600-100-200' }))).toEqual({})
  })

  it('an invoice needs a valid NIP and the company name', () => {
    expect(validateCheckout(validForm({ invoice: true }))).toEqual({
      nip: 'Podaj NIP.',
      company: 'Podaj nazwę firmy.',
    })
    expect(validateCheckout(validForm({ invoice: true, nip: '5260250275', company: 'X' }))).toEqual(
      { nip: 'Sprawdź NIP – suma kontrolna się nie zgadza.' },
    )
    expect(
      validateCheckout(
        validForm({ invoice: true, nip: '526-025-02-74', company: 'Sup Sp. z o.o.' }),
      ),
    ).toEqual({})
  })

  it('a separate invoice address is validated like the delivery address', () => {
    const form = validForm({
      invoice: true,
      nip: '5260250274',
      company: 'Sup Sp. z o.o.',
      separateBilling: true,
    })

    expect(validateCheckout(form)).toEqual({
      'billing.firstName': 'Uzupełnij to pole.',
      'billing.lastName': 'Uzupełnij to pole.',
      'billing.address1': 'Uzupełnij to pole.',
      'billing.postalCode': 'Uzupełnij to pole.',
      'billing.city': 'Uzupełnij to pole.',
    })
    expect(validateCheckout({ ...form, invoice: false })).toEqual({})
  })

  it('a parcel locker needs its code; the card needs no BLIK code', () => {
    expect(
      validateCheckout(validForm({ deliveryCode: 'paczkomat-inpost', parcelLocker: null })),
    ).toEqual({ delivery: 'Wybierz paczkomat.' })
    expect(
      validateCheckout(validForm({ deliveryCode: 'paczkomat-inpost', parcelLocker: 'KRA01M' })),
    ).toEqual({})
    expect(validateCheckout(validForm({ payment: 'card', blikCode: '' }))).toEqual({})
    expect(validateCheckout(validForm({ payment: 'p24', blikCode: '' }))).toEqual({})
    expect(validateCheckout(validForm({ blikCode: '12345' }))).toEqual({
      blikCode: 'Kod BLIK ma 6 cyfr.',
    })
    expect(validateCheckout(validForm({ blikCode: '123 456' }))).toEqual({})
  })

  it('a parcel locker needs a mobile number; a courier takes a landline too', () => {
    const locker = { deliveryCode: 'paczkomat-inpost', parcelLocker: 'KRA01M' }

    expect(validateCheckout(validForm({ ...locker, phone: '22 123 45 67' }))).toEqual({
      phone: MOBILE_FOR_LOCKER,
    })
    expect(validateCheckout(validForm({ ...locker, phone: '600100200' }))).toEqual({})
    expect(validateCheckout(validForm({ phone: '22 123 45 67' }))).toEqual({})
  })
})

describe('uwagi do zamówienia (część 2 §4.3)', () => {
  it('500 znaków przechodzi, 501 – błąd przy polu', () => {
    expect(MAX_CUSTOMER_NOTE).toBe(500)
    expect(validateCheckout(validForm({ customerNote: 'x'.repeat(500) }))).toEqual({})
    expect(validateCheckout(validForm({ customerNote: 'x'.repeat(501) }))).toEqual({
      customerNote: 'Uwagi mogą mieć najwyżej 500 znaków.',
    })
  })

  it('toCartUpdate przycina uwagi; puste czyszczą klucz', () => {
    const now = '2026-10-23T10:00:00.000Z'
    expect(
      toCartUpdate(validForm({ customerNote: '  Proszę dzwonić  ' }), now).metadata.customer_note,
    ).toBe('Proszę dzwonić')
    expect(
      toCartUpdate(validForm({ invoice: true, nip: '5260250274', company: 'Sup' }), now).metadata
        .customer_note,
    ).toBe('')
  })

  it('parseCheckoutForm przyjmuje 500 znaków uwag i zgodę na newsletter', () => {
    const form = validForm({ customerNote: 'x'.repeat(500), newsletter: true })
    expect(parseCheckoutForm(JSON.parse(JSON.stringify(form)))).toEqual(form)
    expect(parseCheckoutForm({ ...form, customerNote: 'x'.repeat(501) })).toBeNull()
    expect(parseCheckoutForm({ ...form, newsletter: 'tak' })).toBeNull()
  })

  it('formFromCart odtwarza uwagi, newsletter zawsze pusty', () => {
    const form = formFromCart({ metadata: { customer_note: 'Domofon 12' } }, [])
    expect(form.customerNote).toBe('Domofon 12')
    expect(form.newsletter).toBe(false)
  })
})

describe('„Chcę założyć konto w sklepie” (część 2 §4.3)', () => {
  it('toCartUpdate zapisuje create_account: tak albo pusto', () => {
    const now = '2026-10-23T10:00:00.000Z'
    expect(toCartUpdate(validForm({ createAccount: true }), now).metadata.create_account).toBe(
      'tak',
    )
    expect(toCartUpdate(validForm(), now).metadata.create_account).toBe('')
  })

  it('formFromCart odtwarza zaznaczenie z metadanych koszyka', () => {
    expect(formFromCart({ metadata: { create_account: 'tak' } }, []).createAccount).toBe(true)
    expect(formFromCart({ metadata: {} }, []).createAccount).toBe(false)
  })

  it('parseCheckoutForm wymaga pola logicznego', () => {
    const form = validForm({ createAccount: true })
    expect(parseCheckoutForm(JSON.parse(JSON.stringify(form)))).toEqual(form)
    expect(parseCheckoutForm({ ...form, createAccount: 'tak' })).toBeNull()
  })
})

describe('normalizers', () => {
  it('formats a postal code and rejects other shapes', () => {
    expect(normalizePostalCode('80001')).toBe('80-001')
    expect(normalizePostalCode(' 80-001 ')).toBe('80-001')
    expect(normalizePostalCode('8-0001')).toBeNull()
    expect(normalizePostalCode('800011')).toBeNull()
  })

  it('keeps Polish phone numbers as +48 and 9 digits', () => {
    expect(normalizePhone('+48 600 100 200')).toBe('+48600100200')
    expect(normalizePhone('600-100-200')).toBe('+48600100200')
    expect(normalizePhone('0048600100200')).toBe('+48600100200')
    expect(normalizePhone('60010020')).toBeNull()
    expect(normalizePhone('+49 600 100 200')).toBeNull()
  })
})

describe('toCartUpdate', () => {
  const at = '2026-10-19T10:00:00.000Z'
  const shipping = {
    first_name: 'Jan',
    last_name: 'Kowalski',
    address_1: 'ul. Morska 5',
    postal_code: '80-001',
    city: 'Gdańsk',
    country_code: 'pl',
    phone: '+48600100200',
  }

  it('without an invoice the billing address is the delivery address and the NIP is cleared', () => {
    // Medusa scala `metadata` – pusty `nip` usuwa NIP z wcześniejszej próby z fakturą.
    expect(toCartUpdate(validForm({ email: ' jan@example.pl ' }), at)).toEqual({
      email: 'jan@example.pl',
      shipping_address: shipping,
      billing_address: shipping,
      metadata: {
        nip: '',
        terms_accepted_at: at,
        save_to_account: '',
        customer_note: '',
        create_account: '',
      },
    })
  })

  it('an invoice adds the company to the address and the normalized NIP to metadata', () => {
    const update = toCartUpdate(
      validForm({ invoice: true, nip: '526-025-02-74', company: ' Sup Sp. z o.o. ' }),
      at,
    )

    expect(update.billing_address).toEqual({ ...shipping, company: 'Sup Sp. z o.o.' })
    expect(update.metadata).toEqual({
      nip: '5260250274',
      terms_accepted_at: at,
      save_to_account: '',
      customer_note: '',
      create_account: '',
    })
  })

  it('„Zapisz dane w koncie” trafia do metadanych koszyka (5a)', () => {
    const update = toCartUpdate(validForm({ saveToAccount: true }), at)
    expect(update.metadata.save_to_account).toBe('tak')
  })

  it('a separate invoice address goes to billing only', () => {
    const update = toCartUpdate(
      validForm({
        invoice: true,
        nip: '5260250274',
        company: 'Sup Sp. z o.o.',
        separateBilling: true,
        billing: {
          firstName: 'Anna',
          lastName: 'Nowak',
          address1: 'ul. Biurowa 1',
          postalCode: '00950',
          city: 'Warszawa',
        },
      }),
      at,
    )

    expect(update.shipping_address).toEqual(shipping)
    expect(update.billing_address).toEqual({
      first_name: 'Anna',
      last_name: 'Nowak',
      address_1: 'ul. Biurowa 1',
      postal_code: '00-950',
      city: 'Warszawa',
      country_code: 'pl',
      company: 'Sup Sp. z o.o.',
    })
  })
})

describe('parseCheckoutForm', () => {
  it('accepts a form from the browser and rejects other shapes', () => {
    const form = validForm()

    expect(parseCheckoutForm(JSON.parse(JSON.stringify(form)))).toEqual(form)
    expect(parseCheckoutForm(null)).toBeNull()
    expect(parseCheckoutForm({ ...form, email: 1 })).toBeNull()
    expect(parseCheckoutForm({ ...form, payment: 'cash' })).toBeNull()
    expect(parseCheckoutForm({ ...form, shipping: { ...address, city: null } })).toBeNull()
    expect(parseCheckoutForm({ ...form, terms: 'yes' })).toBeNull()
    expect(parseCheckoutForm({ ...form, company: 'x'.repeat(201) })).toBeNull()
  })
})

describe('formFromCart', () => {
  const options = [
    { id: 'so_dpd', code: 'kurier-dpd' },
    { id: 'so_locker', code: 'paczkomat-inpost' },
  ]
  const saved = {
    first_name: 'Jan',
    last_name: 'Kowalski',
    address_1: 'ul. Morska 5',
    postal_code: '80-001',
    city: 'Gdańsk',
    country_code: 'pl',
    phone: '+48600100200',
  }

  it('a fresh cart gives an empty form', () => {
    expect(formFromCart({ shipping_address: { country_code: 'pl' } }, options)).toEqual(
      emptyCheckoutForm(),
    )
  })

  it('brings back what the buyer already saved (e.g. after an unfinished payment)', () => {
    const form = formFromCart(
      {
        email: 'jan@example.pl',
        shipping_address: saved,
        billing_address: {
          ...saved,
          first_name: 'Anna',
          address_1: 'ul. Biurowa 1',
          company: 'Sup Sp. z o.o.',
        },
        metadata: { nip: '5260250274' },
        shipping_methods: [
          {
            shipping_option_id: 'so_locker',
            data: { parcel_locker: 'KRA01M', parcel_locker_label: 'ul. Krakowska 1' },
          },
        ],
      },
      options,
    )

    expect(form).toMatchObject({
      email: 'jan@example.pl',
      phone: '+48600100200',
      shipping: { firstName: 'Jan', postalCode: '80-001', city: 'Gdańsk' },
      invoice: true,
      nip: '5260250274',
      company: 'Sup Sp. z o.o.',
      separateBilling: true,
      billing: { firstName: 'Anna', address1: 'ul. Biurowa 1' },
      deliveryOptionId: 'so_locker',
      deliveryCode: 'paczkomat-inpost',
      parcelLocker: 'KRA01M',
      parcelLockerLabel: 'ul. Krakowska 1',
      payment: 'blik',
      terms: false,
    })
  })

  it('a delivery the shop no longer offers is not preselected', () => {
    const form = formFromCart(
      { shipping_methods: [{ shipping_option_id: 'so_gone', data: null }] },
      options,
    )
    expect(form.deliveryOptionId).toBeNull()
  })
})

// Kontrola typów (sprawdza ją `tsc`): `toCartUpdate` wysyła każdy klucz metadanych (`''` czyści
// wartość z wcześniejszej próby), więc typ żadnego nie pomija.
type MetadataWithout<K extends keyof CartUpdate['metadata']> = Omit<CartUpdate['metadata'], K>
// @ts-expect-error – nip jest wymagany
const nipMissing: CartUpdate['metadata'] = {} as MetadataWithout<'nip'>
// @ts-expect-error – save_to_account jest wymagane
const saveMissing: CartUpdate['metadata'] = {} as MetadataWithout<'save_to_account'>
// @ts-expect-error – customer_note jest wymagane
const noteMissing: CartUpdate['metadata'] = {} as MetadataWithout<'customer_note'>
// @ts-expect-error – create_account jest wymagane
const accountMissing: CartUpdate['metadata'] = {} as MetadataWithout<'create_account'>
void [nipMissing, saveMissing, noteMissing, accountMissing]

describe('parseCheckoutForm with what a browser may send', () => {
  it('returns null for null, an array, a string or an unrelated object – never throws', () => {
    for (const value of [null, undefined, [], 'x', 42, { x: 1 }]) {
      expect(parseCheckoutForm(value as unknown)).toBeNull()
    }
  })
})

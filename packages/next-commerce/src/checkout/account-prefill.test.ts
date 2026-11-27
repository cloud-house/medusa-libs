import { describe, expect, it } from 'vitest'
import type { SavedAddress } from './account-prefill'
import { type CheckoutAccount, prefillFromAccount } from './account-prefill'
import { emptyCheckoutForm } from './form'

const home: SavedAddress = {
  id: 'a_home',
  name: 'Dom',
  fields: {
    firstName: 'Anna',
    lastName: 'Nowak',
    address1: 'ul. Morska 12/4',
    postalCode: '80-001',
    city: 'Gdańsk',
  },
  company: null,
  nip: null,
  defaultShipping: true,
  defaultBilling: false,
}
const office: SavedAddress = {
  id: 'a_office',
  name: 'Biuro',
  fields: {
    firstName: 'Anna',
    lastName: 'Nowak',
    address1: 'ul. Długa 1',
    postalCode: '80-002',
    city: 'Gdańsk',
  },
  company: 'Sup Sp. z o.o.',
  nip: '1234563218',
  defaultShipping: false,
  defaultBilling: true,
}
const account = (addresses: SavedAddress[] = [home, office]): CheckoutAccount => ({
  firstName: 'Anna',
  lastName: 'Nowak',
  email: 'anna@example.com',
  phone: '+48600100200',
  addresses,
})

describe('prefillFromAccount', () => {
  it('pusty koszyk – dane konta, domyślny adres dostawy i faktura z domyślnego adresu firmy', () => {
    const form = prefillFromAccount(emptyCheckoutForm(), account())
    expect(form).toMatchObject({
      email: 'anna@example.com',
      phone: '+48600100200',
      shipping: home.fields,
      invoice: true,
      company: 'Sup Sp. z o.o.',
      nip: '1234563218',
      separateBilling: true,
      billing: office.fields,
      saveToAccount: true,
    })
  })

  it('adres zapisany w koszyku wygrywa, e-mail zawsze z konta', () => {
    const shipping = {
      firstName: 'Ola',
      lastName: 'K',
      address1: 'ul. Inna 3',
      postalCode: '00-001',
      city: 'Warszawa',
    }
    const form = prefillFromAccount(
      { ...emptyCheckoutForm(), email: 'stary@example.com', phone: '500600700', shipping },
      account(),
    )
    expect(form.email).toBe('anna@example.com')
    expect(form.phone).toBe('500600700')
    expect(form.shipping).toEqual(shipping)
  })

  it('domyślny adres do faktury bez NIP-u – faktura wyłączona; bez adresów – imię i nazwisko', () => {
    const noNip = { ...office, nip: null }
    expect(prefillFromAccount(emptyCheckoutForm(), account([home, noNip])).invoice).toBe(false)
    const bare = prefillFromAccount(emptyCheckoutForm(), account([]))
    expect(bare.shipping).toMatchObject({ firstName: 'Anna', lastName: 'Nowak', address1: '' })
  })
})

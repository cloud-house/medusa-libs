import { describe, expect, it } from 'vitest'
import { testOrder } from '../checkout/test-order'
import { addressesToSave } from './addresses-to-save'
import type { SavedAddress } from './client'

const saved = (over: Partial<SavedAddress> = {}): SavedAddress => ({
  id: 'a1',
  name: null,
  fields: {
    firstName: 'Jan',
    lastName: 'Kowalski',
    address1: 'ul. Morska 5',
    postalCode: '80-001',
    city: 'Gdańsk',
  },
  company: null,
  nip: null,
  defaultShipping: true,
  defaultBilling: false,
  ...over,
})

const address = {
  first_name: 'Jan',
  last_name: 'Kowalski',
  company: null,
  address_1: 'ul. Morska 5',
  address_2: null,
  postal_code: '80-001',
  city: 'Gdańsk',
  country_code: 'pl',
  phone: '+48600100200',
}

describe('addressesToSave', () => {
  it('ten sam adres już zapisany – nic', () => {
    const order = testOrder({
      shipping_address: address,
      billing_address: address,
      metadata: { nip: '' },
    })
    expect(addressesToSave(order, [saved()])).toEqual([])
  })

  it('nowy adres dostawy – jeden wpis, domyślny, gdy konto nie ma domyślnego', () => {
    const order = testOrder({
      shipping_address: address,
      billing_address: address,
      metadata: { nip: '' },
    })
    expect(addressesToSave(order, [])).toEqual([
      {
        address_name: null,
        first_name: 'Jan',
        last_name: 'Kowalski',
        address_1: 'ul. Morska 5',
        postal_code: '80-001',
        city: 'Gdańsk',
        country_code: 'pl',
        company: null,
        metadata: { nip: '' },
        is_default_shipping: true,
        is_default_billing: false,
      },
    ])
  })

  it('faktura z NIP-em pod tym samym adresem – jeden wpis z firmą i NIP-em', () => {
    const order = testOrder({
      shipping_address: address,
      billing_address: { ...address, company: 'Sup Sp. z o.o.' },
      metadata: { nip: '1234563218' },
    })
    expect(addressesToSave(order, [saved({ defaultBilling: false })])).toEqual([
      expect.objectContaining({
        address_1: 'ul. Morska 5',
        company: 'Sup Sp. z o.o.',
        metadata: { nip: '1234563218' },
        is_default_shipping: false,
        is_default_billing: true,
      }),
    ])
  })
})

import { describe, expect, it } from 'vitest'
import {
  EMPTY_SELLER,
  isSellerComplete,
  isValidPostalCode,
  returnAddressLines,
  returnAddressText,
  type SellerInfo,
  sellerAddress,
  sellerLine,
  toSellerInfo,
} from './seller'

const complete: SellerInfo = {
  ...EMPTY_SELLER,
  companyName: 'Acme sp. z o.o.',
  street: 'ul. Morska 5',
  postalCode: '80-001',
  city: 'Gdańsk',
  nip: 'PL 526-025-02-74',
}

describe('dane sprzedawcy', () => {
  it('składa linię sprzedawcy z kompletnych danych (NIP bez prefiksu i myślników)', () => {
    expect(isSellerComplete(complete)).toBe(true)
    expect(sellerAddress(complete)).toBe('ul. Morska 5, 80-001 Gdańsk')
    expect(sellerLine(complete)).toBe(
      'Acme sp. z o.o., ul. Morska 5, 80-001 Gdańsk, NIP 5260250274',
    )
  })

  it('niekompletne dane nie dają linii sprzedawcy', () => {
    const noCity = { ...complete, city: null }
    expect(isSellerComplete(noCity)).toBe(false)
    expect(sellerLine(noCity)).toBeNull()
    expect(sellerAddress(noCity)).toBeNull()
    expect(isSellerComplete({ ...complete, nip: '  ' })).toBe(false)
    expect(isSellerComplete(EMPTY_SELLER)).toBe(false)
    expect(isSellerComplete(null)).toBe(false)
    expect(sellerLine(undefined)).toBeNull()
  })

  it('adres do zwrotów: osobny adres w jednej linii, a pusty – adres firmy', () => {
    expect(
      returnAddressText({
        ...complete,
        returnAddress: 'Magazyn Acme\nul. Portowa 2\n\n80-002 Gdańsk ',
      }),
    ).toBe('Magazyn Acme, ul. Portowa 2, 80-002 Gdańsk')
    expect(returnAddressText(complete)).toBe('Acme sp. z o.o., ul. Morska 5, 80-001 Gdańsk')
    expect(returnAddressText({ ...complete, city: null })).toBeNull()
    expect(returnAddressText(null)).toBeNull()
  })

  it('adres do zwrotów w liniach: osobny adres przycięty, a pusty – adres firmy', () => {
    expect(
      returnAddressLines({
        ...complete,
        returnAddress: 'Acme – zwroty\n ul. Portowa 3 \n\n80-002 Gdańsk',
      }),
    ).toEqual(['Acme – zwroty', 'ul. Portowa 3', '80-002 Gdańsk'])
    expect(returnAddressLines({ ...complete, returnAddress: '' })).toEqual([
      'Acme sp. z o.o.',
      'ul. Morska 5',
      '80-001 Gdańsk',
    ])
    expect(returnAddressLines({ ...complete, returnAddress: ' \n  ' })).toEqual([
      'Acme sp. z o.o.',
      'ul. Morska 5',
      '80-001 Gdańsk',
    ])
    expect(returnAddressLines(complete)).toEqual([
      'Acme sp. z o.o.',
      'ul. Morska 5',
      '80-001 Gdańsk',
    ])
  })

  it('adres do zwrotów w liniach: osobny adres wystarcza także bez kompletnych danych firmy', () => {
    expect(
      returnAddressLines({ ...EMPTY_SELLER, returnAddress: 'Magazyn\r\nul. Portowa 3' }),
    ).toEqual(['Magazyn', 'ul. Portowa 3'])
  })

  it('adres do zwrotów w liniach: niekompletne dane bez osobnego adresu – null', () => {
    expect(returnAddressLines({ ...complete, city: null })).toBeNull()
    expect(returnAddressLines(EMPTY_SELLER)).toBeNull()
    expect(returnAddressLines(null)).toBeNull()
    expect(returnAddressLines(undefined)).toBeNull()
  })

  it('sprawdza kod pocztowy 00-000', () => {
    expect(isValidPostalCode('80-001')).toBe(true)
    expect(isValidPostalCode('80001')).toBe(false)
    expect(isValidPostalCode('80-0011')).toBe(false)
  })
})

describe('toSellerInfo', () => {
  it('grupa „Dane sprzedawcy” z ustawień: przycięte teksty, puste i inne typy to null', () => {
    expect(
      toSellerInfo({
        companyName: '  Acme sp. z o.o. ',
        street: 'ul. Morska 5',
        postalCode: '',
        city: '   ',
        nip: 5260250274,
        regon: null,
        returnAddress: 'Magazyn\nul. Portowa 1',
        id: 'ignorowane',
      }),
    ).toEqual({
      ...EMPTY_SELLER,
      companyName: 'Acme sp. z o.o.',
      street: 'ul. Morska 5',
      returnAddress: 'Magazyn\nul. Portowa 1',
    })
  })

  it('brak grupy to puste dane', () => {
    expect(toSellerInfo(null)).toEqual(EMPTY_SELLER)
    expect(toSellerInfo(undefined)).toEqual(EMPTY_SELLER)
  })
})

describe('sellerLine options', () => {
  const seller = {
    ...EMPTY_SELLER,
    companyName: 'Acme sp. z o.o.',
    street: 'ul. Morska 5',
    postalCode: '80-001',
    city: 'Gdańsk',
    nip: '526-025-02-74',
  }

  it('defaults to the Polish NIP label', () => {
    expect(sellerLine(seller)).toBe('Acme sp. z o.o., ul. Morska 5, 80-001 Gdańsk, NIP 5260250274')
    expect(sellerLine(seller, { locale: 'pl' })).toBe(sellerLine(seller))
  })

  it('en uses "VAT ID"', () => {
    expect(sellerLine(seller, { locale: 'en' })).toBe(
      'Acme sp. z o.o., ul. Morska 5, 80-001 Gdańsk, VAT ID 5260250274',
    )
  })

  it('taxIdLabel overrides the locale label; undefined does not', () => {
    expect(sellerLine(seller, { taxIdLabel: 'USt-IdNr.' })).toContain(', USt-IdNr. 5260250274')
    expect(sellerLine(seller, { locale: 'en', taxIdLabel: undefined })).toContain('VAT ID')
  })
})

describe('isValidPostalCode country', () => {
  it('defaults to PL and accepts an explicit PL', () => {
    expect(isValidPostalCode('80-001', 'PL')).toBe(true)
    expect(isValidPostalCode('80001', 'PL')).toBe(false)
  })

  it('throws for countries other than PL (no silent fake validation)', () => {
    expect(() => isValidPostalCode('10115', 'DE')).toThrow(/only PL/i)
  })
})

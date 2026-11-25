import { describe, expect, it } from 'vitest'
import { EMPTY_SELLER } from '../seller'
import type { LayoutData } from './layout-types'
import { settingValue } from './setting-values'

const settings: LayoutData['settings'] = {
  freeShippingThreshold: 500,
  shippingCutoff: '14:00',
  returnDays: 30,
  warrantyYears: 2,
  contact: { email: 'sklep@chonasupa.pl', phone: '+48 600 100 200', hours: 'pon.–pt. 9–17' },
  seller: {
    ...EMPTY_SELLER,
    companyName: 'ChoNaSupa sp. z o.o.',
    street: 'ul. Morska 5',
    postalCode: '80-001',
    city: 'Gdańsk',
    nip: '5260250274',
  },
}

describe('wartości z ustawień w treści strony', () => {
  it('formatuje liczby z jednostką i odmianą', () => {
    expect(settingValue('freeShippingThreshold', settings)).toEqual({
      kind: 'text',
      text: '500\u00a0zł',
    })
    expect(settingValue('shippingCutoff', settings)).toEqual({ kind: 'text', text: '14:00' })
    expect(settingValue('returnDays', settings)).toEqual({ kind: 'text', text: '30 dni' })
    expect(settingValue('returnDays', { ...settings, returnDays: 1 }).text).toBe('1 dzień')
    expect(settingValue('returnDays', { ...settings, returnDays: 22 }).text).toBe('22 dni')
    expect(settingValue('warrantyYears', settings).text).toBe('2 lata')
    expect(settingValue('warrantyYears', { ...settings, warrantyYears: 5 }).text).toBe('5 lat')
    expect(settingValue('warrantyYears', { ...settings, warrantyYears: 1 }).text).toBe('1 rok')
  })

  it('e-mail i telefon są linkami', () => {
    expect(settingValue('contactEmail', settings)).toEqual({
      kind: 'link',
      text: 'sklep@chonasupa.pl',
      href: 'mailto:sklep@chonasupa.pl',
    })
    expect(settingValue('contactPhone', settings)).toEqual({
      kind: 'link',
      text: '+48 600 100 200',
      href: 'tel:+48600100200',
    })
    expect(settingValue('contactHours', settings)).toEqual({ kind: 'text', text: 'pon.–pt. 9–17' })
  })

  it('dane sprzedawcy: nazwa i adres do zwrotów', () => {
    expect(settingValue('sellerName', settings).text).toBe('ChoNaSupa sp. z o.o.')
    expect(settingValue('returnAddress', settings).text).toBe(
      'ChoNaSupa sp. z o.o., ul. Morska 5, 80-001 Gdańsk',
    )
  })

  it('brakująca wartość to znacznik do uzupełnienia', () => {
    const empty = { ...settings, contact: {}, seller: EMPTY_SELLER }
    expect(settingValue('contactEmail', empty)).toEqual({
      kind: 'missing',
      text: '[uzupełnij: e-mail kontaktowy]',
    })
    expect(settingValue('contactHours', empty).text).toBe('[uzupełnij: godziny kontaktu]')
    expect(settingValue('sellerName', empty)).toEqual({
      kind: 'missing',
      text: '[uzupełnij dane sprzedawcy]',
    })
    expect(settingValue('returnAddress', empty).text).toBe('[uzupełnij dane sprzedawcy]')
  })
})

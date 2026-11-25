import { describe, expect, it } from 'vitest'
import {
  isSafeLinkUrl,
  validateHref,
  validateOptionalNip,
  validatePostalCode,
  validateTime,
} from './global-validators'

describe('validateHref', () => {
  it('przyjmuje ścieżki w sklepie i pełne adresy https', () => {
    expect(validateHref('/')).toBe(true)
    expect(validateHref('/deski-sup')).toBe(true)
    expect(validateHref('/deski-sup/allround?rozmiar=10-6')).toBe(true)
    expect(validateHref('https://www.instagram.com/chonasupa')).toBe(true)
  })

  it('odrzuca linki bez ukośnika, z innego protokołu i niebezpieczne', () => {
    // „/\evil” przeglądarka czyta jak „//evil” (WHATWG URL) – to też link poza sklep.
    for (const href of [
      'deski-sup',
      '//evil.example',
      '/\\evil.example',
      'http://chonasupa.pl',
      'javascript:alert(1)',
    ]) {
      expect(validateHref(href), href).toMatch(/^Podaj ścieżkę/)
    }
  })

  it('odrzuca spacje w linku', () => {
    expect(validateHref('/deski sup')).toBe('Link nie może zawierać spacji.')
  })

  it('pusty link: błąd, gdy pole jest wymagane; OK, gdy opcjonalne', () => {
    expect(validateHref('')).toBe('Podaj link.')
    expect(validateHref(null)).toBe('Podaj link.')
    expect(validateHref('', { required: false })).toBe(true)
    expect(validateHref(undefined, { required: false })).toBe(true)
  })
})

describe('validateTime', () => {
  it('przyjmuje godzinę GG:MM', () => {
    expect(validateTime('14:00')).toBe(true)
    expect(validateTime('09:30')).toBe(true)
    expect(validateTime('23:59')).toBe(true)
  })

  it('odrzuca inne formaty', () => {
    for (const value of ['9:00', '24:00', '14:60', '14.00', '']) {
      expect(validateTime(value), value).toMatch(/GG:MM/)
    }
  })
})

describe('dane sprzedawcy', () => {
  it('kod pocztowy: pusty albo 00-000', () => {
    expect(validatePostalCode('')).toBe(true)
    expect(validatePostalCode(null)).toBe(true)
    expect(validatePostalCode('80-001')).toBe(true)
    expect(validatePostalCode('80001')).toBe('Kod pocztowy w formacie 00-000.')
  })

  it('NIP: pusty albo z poprawną sumą kontrolną', () => {
    expect(validateOptionalNip(undefined)).toBe(true)
    expect(validateOptionalNip('  ')).toBe(true)
    expect(validateOptionalNip('526-025-02-74')).toBe(true)
    expect(validateOptionalNip('1234567890')).toBe('Nieprawidłowy NIP – sprawdź cyfry.')
  })
})

describe('isSafeLinkUrl', () => {
  it('przyjmuje ścieżki sklepu, kotwice, https, mailto i tel', () => {
    for (const url of [
      '/regulamin',
      '/poradnik/jak?x=1#a',
      '#sekcja',
      'https://chonasupa.pl/a',
      'mailto:sklep@chonasupa.pl',
      'tel:+48 600 100 200',
    ]) {
      expect(isSafeLinkUrl(url)).toBe(true)
    }
  })

  it('odrzuca javascript:, data:, http:, adresy innej domeny bez schematu i puste', () => {
    for (const url of [
      'javascript:alert(1)',
      ' JavaScript:alert(1)',
      'data:text/html,x',
      'http://x.pl',
      '//evil.example',
      '/\\evil.example',
      '',
      null,
    ]) {
      expect(isSafeLinkUrl(url)).toBe(false)
    }
  })
})

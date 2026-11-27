import { describe, expect, it } from 'vitest'
import { safeReturnPath } from './return-path'

describe('safeReturnPath', () => {
  it('ścieżka sklepu przechodzi', () => {
    expect(safeReturnPath('/zamowienie')).toBe('/zamowienie')
    expect(safeReturnPath('/konto/zamowienia/order_1?x=1')).toBe('/konto/zamowienia/order_1?x=1')
  })

  it('adresy spoza sklepu i śmieci wracają do /konto', () => {
    for (const value of [
      '//evil.com',
      'https://evil.com',
      '/\\evil.com',
      'konto',
      '',
      undefined,
      5,
    ]) {
      expect(safeReturnPath(value)).toBe('/konto')
    }
  })

  it('znaki sterujące (tab, nowa linia) nie przemycą adresu innej strony', () => {
    for (const value of ['/\t/evil.com', '/\n/evil.com', '/\r//evil.com', '/%09/evil.com\u0000']) {
      expect(safeReturnPath(value)).toBe('/konto')
    }
  })

  it('ścieżka z zapytaniem i kotwicą zostaje', () => {
    expect(safeReturnPath('/konto/adresy?edytuj=nowy#top')).toBe('/konto/adresy?edytuj=nowy#top')
  })

  it('własny adres zapasowy', () => {
    expect(safeReturnPath(null, '/zamowienie')).toBe('/zamowienie')
  })
})

describe('safeReturnPath – Review Focus 6c', () => {
  it('ukośnik wsteczny i schemat javascript: wracają do /konto', () => {
    for (const value of ['\\evil.com', 'javascript:alert(1)']) {
      expect(safeReturnPath(value)).toBe('/konto')
    }
  })

  it('własny adres zapasowy przy złej ścieżce, poprawna ścieżka bez zmian', () => {
    expect(safeReturnPath('/x', '/start')).toBe('/x')
    expect(safeReturnPath('//x', '/start')).toBe('/start')
  })
})

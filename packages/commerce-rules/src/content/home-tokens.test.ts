import { describe, expect, it } from 'vitest'
import { formatPrice } from '../format-price'
import { DEFAULT_LAYOUT } from './__fixtures__/layout'
import { fillHomeBlockTokens, fillHomeTokens, homeTokenError } from './home-tokens'

const settings = { ...DEFAULT_LAYOUT.settings, returnDays: 30, warrantyYears: 2 }
const UNKNOWN = (token: string) =>
  `Nieznany znacznik ${token}. Dostępne: {prog-darmowej-dostawy}, {godzina-wysylki}, {dni-zwrotu}, {lata-gwarancji}.`

describe('fillHomeTokens', () => {
  it('wstawia wartości z Ustawień sklepu z jednostką i odmianą', () => {
    expect(fillHomeTokens('{dni-zwrotu} na zwrot', settings)).toBe('30 dni na zwrot')
    expect(fillHomeTokens('{lata-gwarancji} gwarancji', settings)).toBe('2 lata gwarancji')
    expect(fillHomeTokens('od {prog-darmowej-dostawy}', settings)).toBe(`od ${formatPrice(500)}`)
    expect(fillHomeTokens('do {godzina-wysylki}', settings)).toBe('do 14:00')
  })

  it('zostawia nieznane znaczniki i zwykły tekst', () => {
    expect(fillHomeTokens('{nieznany}', settings)).toBe('{nieznany}')
    expect(fillHomeTokens('Zwykły tekst', settings)).toBe('Zwykły tekst')
  })

  it('odmienia wartości zmienione w ustawieniach', () => {
    expect(fillHomeTokens('{dni-zwrotu}', { ...settings, returnDays: 1 })).toBe('1 dzień')
    expect(fillHomeTokens('{lata-gwarancji}', { ...settings, warrantyYears: 5 })).toBe('5 lat')
  })
})

describe('homeTokenError', () => {
  it('odrzuca nieznane znaczniki z listą dostępnych', () => {
    expect(homeTokenError('{dni-zwrotu }')).toBe(UNKNOWN('{dni-zwrotu }'))
    expect(homeTokenError('{zwrot} i {dni-zwrotu}')).toBe(UNKNOWN('{zwrot}'))
    expect(homeTokenError('Cena {od}')).toBe(UNKNOWN('{od}'))
  })

  it('przepuszcza tekst bez znaczników, znane znaczniki i puste pole', () => {
    expect(homeTokenError('Zwykły tekst')).toBe(true)
    expect(homeTokenError('{dni-zwrotu} na zwrot')).toBe(true)
    expect(homeTokenError(null)).toBe(true)
    expect(homeTokenError('')).toBe(true)
  })
})

describe('fillHomeBlockTokens', () => {
  it('wypełnia teksty bloku, a adresy, id i handle zostawia', () => {
    const block = {
      type: 'trustBar',
      id: '{dni-zwrotu}',
      items: [{ title: '{dni-zwrotu} na zwrot', text: null }],
      link: { label: 'Od {prog-darmowej-dostawy}', href: '/dostawa?x={dni-zwrotu}' },
      handle: '{lata-gwarancji}',
    }
    expect(fillHomeBlockTokens(block, settings)).toEqual({
      type: 'trustBar',
      id: '{dni-zwrotu}',
      items: [{ title: '30 dni na zwrot', text: null }],
      link: { label: `Od ${formatPrice(500)}`, href: '/dostawa?x={dni-zwrotu}' },
      handle: '{lata-gwarancji}',
    })
  })
})

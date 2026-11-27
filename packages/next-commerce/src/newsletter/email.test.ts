import { describe, expect, it } from 'vitest'
import { MAX_EMAIL_LENGTH, normalizeEmail } from './email'

describe('normalizeEmail', () => {
  it('przycina i zamienia na małe litery', () => {
    expect(normalizeEmail(' Ola@Example.PL ')).toBe('ola@example.pl')
    expect(normalizeEmail('jan.kowalski+sup@poczta.onet.pl')).toBe(
      'jan.kowalski+sup@poczta.onet.pl',
    )
  })

  it.each([
    ['ola@'],
    ['@example.pl'],
    ['ola example@x.pl'],
    ['a@b.c'],
    ['ola..k@x.pl'],
    ['ola@@x.pl'],
    ['ola@x'],
    [''],
    ['   '],
  ])('odrzuca %j', (value) => {
    expect(normalizeEmail(value)).toBeNull()
  })

  it('odrzuca adres dłuższy niż limit i wartości spoza tekstu', () => {
    expect(MAX_EMAIL_LENGTH).toBe(254)
    expect(normalizeEmail(`${'x'.repeat(250)}@x.pl`)).toBeNull()
    expect(normalizeEmail(42)).toBeNull()
    expect(normalizeEmail(null)).toBeNull()
  })
})

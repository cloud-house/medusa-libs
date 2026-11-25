import { describe, expect, it } from 'vitest'
import { isPolishMobile, MOBILE_FOR_LOCKER, MOBILE_PREFIXES } from './phone'

describe('isPolishMobile', () => {
  it.each([
    ['600 100 200'],
    ['+48 512-345-678'],
    ['0048451234567'],
    ['880000000'],
    ['(66) 123 456 7'],
  ])('accepts %s', (phone) => {
    expect(isPolishMobile(phone)).toBe(true)
  })

  it.each([
    ['221234567'],
    ['+48 22 123 45 67'],
    ['700123456'],
    ['12345678'],
    ['6001002003'],
    ['+48 600 100 20a'],
    [''],
    [null],
    [undefined],
  ])('rejects %s', (phone) => {
    expect(isPolishMobile(phone)).toBe(false)
  })

  it('knows every mobile prefix', () => {
    for (const prefix of MOBILE_PREFIXES) expect(isPolishMobile(`${prefix}1234567`)).toBe(true)
    expect(MOBILE_PREFIXES).toHaveLength(13)
  })
})

describe('MOBILE_FOR_LOCKER', () => {
  it('asks for a mobile number the pick-up code can be sent to', () => {
    expect(MOBILE_FOR_LOCKER).toBe(
      'Do paczkomatu potrzebny jest numer komórkowy – przyjdzie na niego kod odbioru.',
    )
  })
})

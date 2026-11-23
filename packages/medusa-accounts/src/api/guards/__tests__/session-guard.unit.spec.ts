import { isStaleToken } from '../session-guard'

describe('isStaleToken', () => {
  it('token wydany przed znacznikiem „sesje ważne od” jest nieważny', () => {
    expect(isStaleToken(100, 101)).toBe(true)
  })

  it('token z tej samej sekundy co znacznik zostaje ważny', () => {
    expect(isStaleToken(101, 101)).toBe(false)
  })

  it('token bez iat przy ustawionym znaczniku jest nieważny', () => {
    expect(isStaleToken(undefined, 5)).toBe(true)
  })

  it('bez znacznika każdy token jest ważny', () => {
    expect(isStaleToken(100, undefined)).toBe(false)
  })

  it('znacznik, który nie jest liczbą, jest pomijany', () => {
    expect(isStaleToken(100, '101')).toBe(false)
  })
})

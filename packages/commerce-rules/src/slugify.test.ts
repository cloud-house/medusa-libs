import { describe, expect, it } from 'vitest'
import { HANDLE_PATTERN, slugify } from './slugify'

describe('slugify', () => {
  it.each([
    ['Turkus', 'turkus'],
    [`10'6"`, '10-6'],
    ['Żółty', 'zolty'],
    ['Wiosło karbonowe', 'wioslo-karbonowe'],
    ['  --a--  ', 'a'],
  ])('%s → %s', (text, expected) => {
    expect(slugify(text)).toBe(expected)
  })
})

describe('HANDLE_PATTERN', () => {
  it.each(['f2', 'aqua-marina', 'a1-b2-c3'])('accepts %s', (handle) => {
    expect(HANDLE_PATTERN.test(handle)).toBe(true)
  })

  it.each(['', 'F2', 'F 2!', '-a', 'a-', 'a--b', 'żółty'])('rejects "%s"', (handle) => {
    expect(HANDLE_PATTERN.test(handle)).toBe(false)
  })

  it('accepts everything slugify produces', () => {
    for (const text of ['Aqua  Marina', 'Żółty', `10'6"`, 'F2']) {
      expect(HANDLE_PATTERN.test(slugify(text))).toBe(true)
    }
  })
})

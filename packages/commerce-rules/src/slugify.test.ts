import { describe, expect, it } from 'vitest'
import { slugify } from './slugify'

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

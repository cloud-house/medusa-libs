import { describe, expect, it } from 'vitest'
import { isValidNip, normalizeNip } from './nip'

describe('NIP', () => {
  it('accepts a valid NIP with or without separators and the PL prefix', () => {
    expect(isValidNip('5260250274')).toBe(true)
    expect(isValidNip('526-025-02-74')).toBe(true)
    expect(isValidNip('PL 526 025 02 74')).toBe(true)
    expect(normalizeNip('PL 526-025-02-74')).toBe('5260250274')
  })

  it('rejects a wrong checksum, wrong length and all zeros', () => {
    expect(isValidNip('5260250275')).toBe(false)
    expect(isValidNip('123')).toBe(false)
    expect(isValidNip('')).toBe(false)
    expect(isValidNip('0000000000')).toBe(false)
  })
})

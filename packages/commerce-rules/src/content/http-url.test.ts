import { describe, expect, it } from 'vitest'
import { validateHttpUrl } from './http-url'

describe('link do autora zdjęcia', () => {
  it('przyjmuje pusty albo adres http(s), odrzuca inne schematy', () => {
    expect(validateHttpUrl('')).toBe(true)
    expect(validateHttpUrl(null)).toBe(true)
    expect(validateHttpUrl('https://unsplash.com/@basakar')).toBe(true)
    expect(validateHttpUrl('javascript:alert(1)')).not.toBe(true)
    expect(validateHttpUrl('unsplash.com/@basakar')).not.toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { plainText, variantTitle } from './text'

describe('variantTitle', () => {
  it('adds size and colour to the model name', () => {
    expect(variantTitle('Allround Wave', `10'6"`, 'Turkus')).toBe(`Allround Wave 10'6" Turkus`)
  })

  it('skips a size or colour that is a whole word of the model name', () => {
    expect(variantTitle(`Mini Wave 8'0"`, `8'0"`, 'Żółty')).toBe(`Mini Wave 8'0" Żółty`)
    expect(variantTitle('Torba 20 L', '20 L', null)).toBe('Torba 20 L')
    expect(variantTitle('Wave Turkus', null, 'turkus')).toBe('Wave Turkus')
  })

  it('keeps letter sizes that only appear inside a word of the model name', () => {
    for (const size of ['S', 'M', 'L', 'XL']) {
      expect(variantTitle('Kamizelka Float 50N', size, null)).toBe(`Kamizelka Float 50N ${size}`)
    }
  })
})

describe('plainText', () => {
  it('strips tags, decodes basic entities and collapses spaces', () => {
    expect(plainText('<p>A&amp;B&nbsp;<b>c</b></p>')).toBe('A&B c')
    expect(plainText(null)).toBe('')
    expect(plainText(undefined)).toBe('')
  })
})

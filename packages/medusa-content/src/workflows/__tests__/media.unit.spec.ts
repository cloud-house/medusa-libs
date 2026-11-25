import { safeName } from '../media'

describe('safeName', () => {
  it('keeps the base name only and plain characters', () => {
    expect(safeName('../../x.png')).toBe('x.png')
    expect(safeName('C:\\temp\\a b.png')).toBe('a b.png')
    expect(safeName('..hidden')).toBe('hidden')
    expect(safeName('zażółć.png')).toBe('za_.png')
    expect(safeName('/')).toBe('file')
  })
})

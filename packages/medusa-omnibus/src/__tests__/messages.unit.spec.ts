import { formatLog, messages, resolveMessages } from '../messages'
import { resolveOptions } from '../options'

describe('messages', () => {
  it('keeps the Polish text of the first shop', () => {
    expect(messages.pl.recorded(3)).toBe('zapisano 3 zmian cen w historii (Omnibus).')
  })

  it('has an English text with the count', () => {
    expect(messages.en.recorded(3)).toContain('3')
  })

  it('has the same keys in both dictionaries', () => {
    expect(Object.keys(messages.en).sort()).toEqual(Object.keys(messages.pl).sort())
  })

  it('resolveMessages merges overrides over the locale dictionary', () => {
    const resolved = resolveMessages('pl', { recorded: (count) => `rec ${count}` })
    expect(resolved.recorded(2)).toBe('rec 2')
    expect(resolveMessages('en', {}).recorded(1)).toBe(messages.en.recorded(1))
  })

  it('resolveMessages ignores undefined overrides', () => {
    const resolved = resolveMessages('pl', { recorded: undefined })
    expect(resolved.recorded(3)).toBe('zapisano 3 zmian cen w historii (Omnibus).')
  })
})

describe('formatLog', () => {
  it('prefixes the text with the log prefix', () => {
    expect(formatLog('Shop', 'x')).toBe('Shop: x')
  })

  it('leaves the text alone without a prefix', () => {
    expect(formatLog('', 'x')).toBe('x')
    expect(formatLog(undefined, 'x')).toBe('x')
  })
})

describe('resolveOptions', () => {
  it('defaults: Polish, no prefix', () => {
    const options = resolveOptions()
    expect(options.locale).toBe('pl')
    expect(options.logPrefix).toBe('')
    expect(options.messages.recorded(1)).toBe(messages.pl.recorded(1))
  })

  it('ignores undefined options and overrides', () => {
    const options = resolveOptions({ locale: undefined, logPrefix: undefined, messages: undefined })
    expect(options.locale).toBe('pl')
    expect(options.logPrefix).toBe('')
  })

  it('uses the locale dictionary under the overrides and keeps the prefix', () => {
    const options = resolveOptions({
      locale: 'en',
      logPrefix: 'Shop',
      messages: { recorded: undefined },
    })
    expect(options.logPrefix).toBe('Shop')
    expect(options.messages.recorded(4)).toBe(messages.en.recorded(4))
  })

  it('rejects an unknown locale', () => {
    expect(() => resolveOptions({ locale: 'de' as 'pl' })).toThrow(/de/)
  })
})

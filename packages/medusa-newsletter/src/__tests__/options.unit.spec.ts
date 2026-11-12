import { messages, resolveMessages } from '../messages'
import { resolveOptions } from '../options'

describe('resolveMessages', () => {
  it('resolveMessages merges overrides over the locale dictionary', () => {
    const pl = resolveMessages('pl', { alreadySubscribed: 'X' })
    expect(pl.alreadySubscribed).toBe('X')
    expect(pl.unauthorized).toBe('Brak dostępu.')
    expect(resolveMessages('en', {}).csvColumns).toEqual([
      'email',
      'consent_date',
      'source',
      'consent_text',
    ])
  })

  it('ignores undefined overrides', () => {
    const resolved = resolveMessages('pl', {
      alreadySubscribed: undefined,
      sourceLabels: { footer: undefined, home: 'Start' } as unknown as Record<string, string>,
    })
    expect(resolved.alreadySubscribed).toBe(messages.pl.alreadySubscribed)
    expect(resolved.sourceLabels.footer).toBe('Stopka')
    expect(resolved.sourceLabels.home).toBe('Start')
  })

  it('keeps the Polish texts of the first shop', () => {
    expect(messages.pl.alreadySubscribed).toBe('Ten adres jest już zapisany.')
    expect(messages.pl.csvColumns).toEqual(['email', 'data_zgody', 'zrodlo', 'tresc_zgody'])
    expect(messages.pl.sourceLabels).toEqual({
      footer: 'Stopka',
      home: 'Strona główna',
      register: 'Rejestracja konta',
      checkout: 'Kasa',
    })
  })

  it('overrides single source labels and keeps the others', () => {
    const labels = resolveMessages('pl', { sourceLabels: { footer: 'Dół strony' } }).sourceLabels
    expect(labels.footer).toBe('Dół strony')
    expect(labels.checkout).toBe('Kasa')
  })

  it('has every key in both dictionaries', () => {
    expect(Object.keys(messages.en).sort()).toEqual(Object.keys(messages.pl).sort())
  })
})

describe('resolveOptions', () => {
  it('defaults: Polish, x-storefront-secret, STOREFRONT_API_SECRET, every source', () => {
    const options = resolveOptions()
    expect(options.locale).toBe('pl')
    expect(options.storefrontSecret).toEqual({
      header: 'x-storefront-secret',
      env: 'STOREFRONT_API_SECRET',
    })
    expect(options.sources).toEqual(['footer', 'home', 'register', 'checkout'])
    expect(options.messages).toEqual(messages.pl)
  })

  it('ignores undefined overrides', () => {
    const options = resolveOptions({
      locale: undefined,
      messages: { alreadySubscribed: undefined },
      sources: undefined,
      storefrontSecret: { header: undefined, env: undefined },
    })
    expect(options.locale).toBe('pl')
    expect(options.messages).toEqual(messages.pl)
    expect(options.sources).toEqual(['footer', 'home', 'register', 'checkout'])
    expect(options.storefrontSecret).toEqual({
      header: 'x-storefront-secret',
      env: 'STOREFRONT_API_SECRET',
    })
  })

  it('rejects an empty sources list', () => {
    expect(() => resolveOptions({ sources: [] })).toThrow(/sources must not be empty/)
  })

  it('uses the locale dictionary under the overrides', () => {
    const options = resolveOptions({ locale: 'en', messages: { unauthorized: 'Nope.' } })
    expect(options.messages.unauthorized).toBe('Nope.')
    expect(options.messages.alreadySubscribed).toBe(messages.en.alreadySubscribed)
  })

  it('takes the secret header (lower-cased, as Node keeps headers) and env from the options', () => {
    const options = resolveOptions({ storefrontSecret: { header: 'X-Shop-Secret' } })
    expect(options.storefrontSecret).toEqual({
      header: 'x-shop-secret',
      env: 'STOREFRONT_API_SECRET',
    })
  })

  it('rejects a source the model does not know', () => {
    expect(() => resolveOptions({ sources: ['footer', 'popup'] })).toThrow(/popup/)
  })

  it('rejects an unknown locale', () => {
    expect(() => resolveOptions({ locale: 'de' as 'pl' })).toThrow(/de/)
  })
})

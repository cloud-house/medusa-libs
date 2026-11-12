import { FAVORITES_ERROR_CODES, formatLimitMessage, messages, resolveOptions } from '..'

describe('resolveOptions', () => {
  it('fills in the defaults: limit 100, Polish texts', () => {
    const options = resolveOptions()
    expect(options.limit).toBe(100)
    expect(options.locale).toBe('pl')
    expect(options.messages).toEqual(messages.pl)
  })

  it('keeps the Polish texts of the shop word for word, the limit message with 100', () => {
    const options = resolveOptions()
    expect(options.messages.productNotFound).toBe('Nie znaleziono produktu.')
    expect(formatLimitMessage(options)).toBe(
      'Masz już 100 ulubionych – usuń któryś, żeby dodać nowy.',
    )
  })

  it('puts the limit option into the limit message', () => {
    expect(formatLimitMessage(resolveOptions({ limit: 3 }))).toBe(
      'Masz już 3 ulubionych – usuń któryś, żeby dodać nowy.',
    )
  })

  it('switches the dictionary with the locale and lets single texts override it', () => {
    const options = resolveOptions({ locale: 'en', messages: { productNotFound: 'Gone.' } })
    expect(options.messages.productNotFound).toBe('Gone.')
    expect(options.messages.limitReached).toBe(messages.en.limitReached)
  })

  it('ignores undefined overrides instead of wiping the defaults', () => {
    const options = resolveOptions({
      limit: undefined,
      locale: undefined,
      messages: { productNotFound: undefined, limitReached: 'Max {limit}.' },
    })
    expect(options.limit).toBe(100)
    expect(options.locale).toBe('pl')
    expect(options.messages.productNotFound).toBe('Nie znaleziono produktu.')
    expect(formatLimitMessage(options)).toBe('Max 100.')
  })

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects the limit %s', (limit) => {
    expect(() => resolveOptions({ limit })).toThrow(/limit/)
  })

  it('rejects an unknown locale', () => {
    // @ts-expect-error not a locale
    expect(() => resolveOptions({ locale: 'de' })).toThrow(/locale/)
  })

  it('has the two error codes', () => {
    expect(FAVORITES_ERROR_CODES).toEqual({
      limitReached: 'favorites_limit_reached',
      productNotFound: 'product_not_found',
    })
  })
})

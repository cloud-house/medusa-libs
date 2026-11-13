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
      'Masz już 3 ulubione – usuń któryś, żeby dodać nowy.',
    )
  })

  it.each([
    [1, 'Masz już 1 ulubiony – usuń któryś, żeby dodać nowy.'],
    [2, 'Masz już 2 ulubione – usuń któryś, żeby dodać nowy.'],
    [3, 'Masz już 3 ulubione – usuń któryś, żeby dodać nowy.'],
    [5, 'Masz już 5 ulubionych – usuń któryś, żeby dodać nowy.'],
    [12, 'Masz już 12 ulubionych – usuń któryś, żeby dodać nowy.'],
    [22, 'Masz już 22 ulubione – usuń któryś, żeby dodać nowy.'],
    [100, 'Masz już 100 ulubionych – usuń któryś, żeby dodać nowy.'],
  ])('Polish limit message for %i', (limit, expected) => {
    expect(formatLimitMessage(resolveOptions({ limit }))).toBe(expected)
  })

  it.each([
    [1, 'You already have 1 favourite – remove one to add a new one.'],
    [2, 'You already have 2 favourites – remove one to add a new one.'],
    [100, 'You already have 100 favourites – remove one to add a new one.'],
  ])('English limit message for %i', (limit, expected) => {
    expect(formatLimitMessage(resolveOptions({ limit, locale: 'en' }))).toBe(expected)
  })

  it('uses an overriding limit text as it is, with {limit} replaced', () => {
    const options = resolveOptions({ limit: 3, messages: { limitReached: 'Max {limit} sztuk.' } })
    expect(formatLimitMessage(options)).toBe('Max 3 sztuk.')
    expect(
      formatLimitMessage(
        resolveOptions({ limit: 2, messages: { limitReached: 'Limit {limit} {favorites}.' } }),
      ),
    ).toBe('Limit 2 ulubione.')
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
      productNotFound: 'favorites_product_not_found',
    })
  })
})

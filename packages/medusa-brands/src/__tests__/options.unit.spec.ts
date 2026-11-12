import { messages, resolveMessages } from '../messages'
import { resolveOptions } from '../options'

describe('resolveMessages', () => {
  it('merges overrides over the locale dictionary', () => {
    const pl = resolveMessages('pl', { saved: 'OK' })
    expect(pl.saved).toBe('OK')
    expect(pl.handleInvalid).toBe(messages.pl.handleInvalid)
    expect(resolveMessages('en', {}).adminTitle).toBe('Brands')
  })

  it('ignores undefined overrides', () => {
    const resolved = resolveMessages('pl', { saved: undefined, edit: 'Zmień' })
    expect(resolved.saved).toBe('Zapisano markę')
    expect(resolved.edit).toBe('Zmień')
  })

  it('keeps the Polish texts of the first shop', () => {
    expect(messages.pl).toMatchObject({
      nameRequired: 'Podaj nazwę marki.',
      nameTooLong: 'Nazwa marki ma najwyżej 80 znaków.',
      handleInvalid: 'Adres marki może zawierać tylko małe litery, cyfry i pojedyncze myślniki.',
      handleUnderivable:
        'Z tej nazwy nie da się utworzyć adresu marki – podaj adres (handle) ręcznie.',
      handleTaken: 'Marka o adresie „{handle}” już istnieje.',
      productNotFound: 'Nie znaleziono produktu {id}.',
      adminTitle: 'Marki',
      adminDescription: 'Marki produktów. Markę produktu ustawisz na stronie produktu.',
      handleHint: 'Używany w adresach marki: {handle}',
      addBrand: 'Dodaj markę',
      newBrand: 'Nowa marka',
      editBrand: 'Edytuj markę',
      fieldHandle: 'Adres (handle)',
      handlePlaceholder: 'np. aqua-marina – puste: z nazwy',
      saved: 'Zapisano markę',
      deleted: 'Usunięto markę',
      deleteTitle: 'Usunąć markę {name}?',
      deleteDescription: '{count} produktów straci przypisanie do tej marki.',
      deleteDescriptionEmpty: 'Marka nie ma przypisanych produktów.',
      empty: 'Nie ma jeszcze żadnej marki.',
      widgetTitle: 'Marka',
      widgetPlaceholder: 'Wybierz markę',
      widgetNone: 'Brak marki',
      widgetEmpty: 'Najpierw dodaj marki w sekcji „Marki”.',
    })
  })

  it('has every key in both dictionaries', () => {
    expect(Object.keys(messages.en).sort()).toEqual(Object.keys(messages.pl).sort())
  })
})

describe('resolveOptions', () => {
  it('defaults: Polish and the store route on', () => {
    const options = resolveOptions()
    expect(options.locale).toBe('pl')
    expect(options.storeRoute).toBe(true)
    expect(options.adminDetailLinks).toBe(false)
    expect(options.messages).toEqual(messages.pl)
  })

  it('ignores undefined overrides', () => {
    const options = resolveOptions({
      locale: undefined,
      storeRoute: undefined,
      adminDetailLinks: undefined,
      messages: { saved: undefined },
    })
    expect(options.locale).toBe('pl')
    expect(options.storeRoute).toBe(true)
    expect(options.adminDetailLinks).toBe(false)
    expect(options.messages).toEqual(messages.pl)
  })

  it('takes adminDetailLinks: true', () => {
    expect(resolveOptions({ adminDetailLinks: true }).adminDetailLinks).toBe(true)
  })

  it('takes storeRoute: false', () => {
    expect(resolveOptions({ storeRoute: false }).storeRoute).toBe(false)
  })

  it('uses the locale dictionary under the overrides', () => {
    const options = resolveOptions({ locale: 'en', messages: { saved: 'Done' } })
    expect(options.messages.saved).toBe('Done')
    expect(options.messages.edit).toBe(messages.en.edit)
  })

  it('rejects an unknown locale', () => {
    expect(() => resolveOptions({ locale: 'de' as 'pl' })).toThrow(/de/)
  })
})

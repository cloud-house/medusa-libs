import { describe, expect, it } from 'vitest'
import { EMPTY_SELLER } from '../seller'
import { DEFAULT_LAYOUT } from './__fixtures__/layout'
import { freeShippingFrom, type RawLayoutGlobals, resolveLayoutData } from './layout-views'
import { NEUTRAL_LAYOUT } from './neutral-defaults'

const resolve = (raw: RawLayoutGlobals) => resolveLayoutData(raw, DEFAULT_LAYOUT)

const SAVED: RawLayoutGlobals = {
  header: { navigation: [{ label: 'Deski', href: '/deski-sup' }] },
  announcement: {
    enabled: true,
    items: [
      { text: 'Wiosło karbonowe −40% do zestawów Touring', href: '/zestawy' },
      { text: 'Darmowa wysyłka od 500 zł', href: '' },
    ],
  },
  footer: {
    tagline: 'Deski SUP sprawdzonych marek.',
    columns: [{ heading: 'Pomoc', links: [{ label: 'Kontakt', href: '/kontakt' }] }],
    paymentMethods: 'BLIK · Visa',
  },
  settings: {
    freeShippingThreshold: 400,
    shippingCutoff: '13:00',
    returnDays: 30,
    warrantyYears: 2,
    contactEmail: ' sklep@example.pl ',
    contactPhone: '',
    contactHours: null,
    instagramUrl: 'https://www.instagram.com/chonasupa',
  },
}

describe('resolveLayoutData', () => {
  it('zapisane globale wygrywają z domyślnymi', () => {
    expect(resolve(SAVED)).toEqual({
      navigation: [{ label: 'Deski', href: '/deski-sup' }],
      announcement: {
        enabled: true,
        items: [
          { text: 'Wiosło karbonowe −40% do zestawów Touring', href: '/zestawy' },
          { text: 'Darmowa wysyłka od 500 zł' },
        ],
      },
      footer: {
        tagline: 'Deski SUP sprawdzonych marek.',
        columns: [{ heading: 'Pomoc', links: [{ label: 'Kontakt', href: '/kontakt' }] }],
        paymentMethods: 'BLIK · Visa',
        newsletter: { enabled: true, heading: 'Zapisz się. Pierwsi dowiesz się o nowych deskach.' },
      },
      settings: {
        freeShippingThreshold: 400,
        shippingCutoff: '13:00',
        returnDays: 30,
        warrantyYears: 2,
        contact: { email: 'sklep@example.pl' },
        instagramUrl: 'https://www.instagram.com/chonasupa',
        seller: EMPTY_SELLER,
      },
    })
  })

  it('newsletter w stopce: domyślnie włączony z domyślnym nagłówkiem', () => {
    const footer = SAVED.footer ?? {}
    expect(resolve(SAVED).footer.newsletter).toEqual({
      enabled: true,
      heading: 'Zapisz się. Pierwsi dowiesz się o nowych deskach.',
    })
    expect(
      resolve({
        ...SAVED,
        footer: { ...footer, newsletter: { enabled: false, heading: '  ' } },
      }).footer.newsletter,
    ).toEqual({ enabled: false, heading: 'Zapisz się. Pierwsi dowiesz się o nowych deskach.' })
    expect(
      resolve({
        ...SAVED,
        footer: { ...footer, newsletter: { enabled: null, heading: ' Bądź na bieżąco ' } },
      }).footer.newsletter,
    ).toEqual({ enabled: true, heading: 'Bądź na bieżąco' })
    expect(resolve({ ...SAVED, footer: null }).footer.newsletter).toEqual(
      DEFAULT_LAYOUT.footer.newsletter,
    )
  })

  it('dane sprzedawcy: przycięte, puste pola jako null', () => {
    const settings = resolve({
      ...SAVED,
      settings: {
        ...SAVED.settings,
        seller: {
          companyName: ' ChoNaSupa sp. z o.o. ',
          street: 'ul. Morska 5',
          postalCode: '80-001',
          city: 'Gdańsk',
          nip: '5260250274',
          regon: '',
          registry: '   ',
          returnAddress: null,
        },
      },
    }).settings
    expect(settings.seller).toEqual({
      ...EMPTY_SELLER,
      companyName: 'ChoNaSupa sp. z o.o.',
      street: 'ul. Morska 5',
      postalCode: '80-001',
      city: 'Gdańsk',
      nip: '5260250274',
    })
    expect(DEFAULT_LAYOUT.settings.seller).toEqual(EMPTY_SELLER)
  })

  it('global, którego nie udało się odczytać (null), dostaje domyślne treści', () => {
    expect(resolve({ header: null, announcement: null, footer: null, settings: null })).toEqual(
      DEFAULT_LAYOUT,
    )
  })

  it('zapisany pasek bez komunikatów zostaje pusty – domyślne nie wracają', () => {
    const layout = resolve({ ...SAVED, announcement: { enabled: true, items: [] } })
    expect(layout.announcement).toEqual({ enabled: true, items: [] })
  })

  it('puste menu zastępuje domyślnym (header bez menu nie ma sensu)', () => {
    const layout = resolve({ ...SAVED, header: { navigation: [] } })
    expect(layout.navigation).toEqual(DEFAULT_LAYOUT.navigation)
  })

  it('przekazuje id wierszy z panelu (stabilne klucze przy powtórzonych tekstach)', () => {
    const layout = resolve({
      ...SAVED,
      header: { navigation: [{ id: 'nav-1', label: 'Deski', href: '/deski-sup' }] },
      announcement: { enabled: true, items: [{ id: 'bar-1', text: 'Darmowa wysyłka' }] },
      footer: {
        ...SAVED.footer,
        columns: [
          {
            id: 'col-1',
            heading: 'Pomoc',
            links: [{ id: 'link-1', label: 'Kontakt', href: '/kontakt' }],
          },
        ],
      },
    })

    expect(layout.navigation).toEqual([{ id: 'nav-1', label: 'Deski', href: '/deski-sup' }])
    expect(layout.announcement.items).toEqual([{ id: 'bar-1', text: 'Darmowa wysyłka' }])
    expect(layout.footer.columns).toEqual([
      {
        id: 'col-1',
        heading: 'Pomoc',
        links: [{ id: 'link-1', label: 'Kontakt', href: '/kontakt' }],
      },
    ])
  })

  it('opis stopki z samych spacji jest pusty (bez pustego akapitu), inny – przycięty', () => {
    const footerWith = (tagline: string) =>
      resolve({ ...SAVED, footer: { ...SAVED.footer, tagline } }).footer.tagline

    expect(footerWith('   ')).toBe('')
    expect(footerWith('  Deski SUP sprawdzonych marek. ')).toBe('Deski SUP sprawdzonych marek.')
  })

  it('pomija kolumny stopki bez linków', () => {
    const layout = resolve({
      ...SAVED,
      footer: { ...SAVED.footer, columns: [{ heading: 'Pusta', links: [] }] },
    })
    expect(layout.footer.columns).toEqual([])
  })
})

describe('freeShippingFrom', () => {
  it('najwyższy próg spośród metod dostawy (obietnica prawdziwa dla każdej); bez darmowej – null', () => {
    expect(freeShippingFrom([{ free_from: 300 }, { free_from: 500 }, { free_from: null }])).toBe(
      500,
    )
    expect(freeShippingFrom([{ free_from: null }])).toBeNull()
    expect(freeShippingFrom([])).toBeNull()
  })
})

describe('resolveLayoutData – domyślne neutralne', () => {
  it('bez danych i bez domyślnych sklepu zwraca NEUTRAL_LAYOUT', () => {
    expect(
      resolveLayoutData({ header: null, announcement: null, footer: null, settings: null }),
    ).toEqual(NEUTRAL_LAYOUT)
  })
})

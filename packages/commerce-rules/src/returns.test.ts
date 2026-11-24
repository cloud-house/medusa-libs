import { describe, expect, it } from 'vitest'
import {
  isReturnEligible,
  isReturnReasonCode,
  RETURN_MESSAGES,
  RETURN_NOTE_MAX,
  RETURN_OPTION_CODE,
  RETURN_REASONS,
  RETURN_STATUS_LABELS,
  RETURN_WINDOW_DAYS,
  returnableQuantity,
  returnExpiredMessage,
  returnLastDay,
  returnReasonLabel,
  returnStatusKey,
  returnWindowStart,
  warsawDay,
} from './returns'

describe('stałe zwrotu', () => {
  it('wartości zapasowe i kod opcji zwrotnej', () => {
    expect(RETURN_WINDOW_DAYS).toBe(30)
    expect(RETURN_OPTION_CODE).toBe('zwrot-wlasny')
    expect(RETURN_NOTE_MAX).toBe(500)
  })

  it('powody zwrotu w kolejności listy', () => {
    expect(RETURN_REASONS.map((reason) => [reason.id, reason.label])).toEqual([
      ['size', 'Niewłaściwy rozmiar'],
      ['color', 'Inny kolor niż na zdjęciu'],
      ['not_as_described', 'Towar niezgodny z opisem'],
      ['defect', 'Wada / uszkodzenie'],
      ['mind_changed', 'Rezygnacja bez podania przyczyny'],
    ])
  })

  it('komunikaty dosłownie', () => {
    expect(RETURN_MESSAGES).toEqual({
      notShipped:
        'Zwrot zgłosisz, gdy wyślemy zamówienie. Jeśli chcesz z niego zrezygnować wcześniej, napisz do nas.',
      canceled: 'Zamówienie jest anulowane – nie ma czego zwracać.',
      nothingLeft: 'Wszystkie produkty z tego zamówienia są już zgłoszone do zwrotu.',
      quantity:
        'Tych produktów nie można już zwrócić w takiej ilości – odśwież stronę i sprawdź ilości.',
      reason: 'Wybierz powód zwrotu z listy.',
      guestNotFound: 'Nie znaleźliśmy zamówienia o tym numerze z tym adresem e-mail.',
      busy: 'Zgłoszenie do tego zamówienia jest właśnie zapisywane – spróbuj za chwilę.',
    })
  })

  it('komunikat po terminie z liczbą dni z ustawienia', () => {
    expect(returnExpiredMessage(30)).toBe(
      'Minął termin na zwrot towaru (30 dni od otrzymania paczki)',
    )
    expect(returnExpiredMessage(45)).toBe(
      'Minął termin na zwrot towaru (45 dni od otrzymania paczki)',
    )
  })
})

describe('powody zwrotu', () => {
  it('rozpoznaje kody z tabeli, resztę odrzuca', () => {
    expect(isReturnReasonCode('mind_changed')).toBe(true)
    expect(isReturnReasonCode('size')).toBe(true)
    expect(isReturnReasonCode('inne')).toBe(false)
    expect(isReturnReasonCode('')).toBe(false)
    expect(isReturnReasonCode(null)).toBe(false)
    expect(isReturnReasonCode(undefined)).toBe(false)
    expect(isReturnReasonCode(3)).toBe(false)
  })

  it('etykieta po kodzie; nieznany kod albo brak – null', () => {
    expect(returnReasonLabel('defect')).toBe('Wada / uszkodzenie')
    expect(returnReasonLabel('inne')).toBeNull()
    expect(returnReasonLabel(null)).toBeNull()
  })
})

describe('status zwrotu', () => {
  it('klucze statusów Medusy; open (szkic panelu) i nieznane – null', () => {
    expect(returnStatusKey('requested')).toBe('requested')
    expect(returnStatusKey('partially_received')).toBe('partially_received')
    expect(returnStatusKey('received')).toBe('received')
    expect(returnStatusKey('canceled')).toBe('canceled')
    expect(returnStatusKey('open')).toBeNull()
    expect(returnStatusKey('cokolwiek')).toBeNull()
    expect(returnStatusKey('')).toBeNull()
  })

  it('etykiety dla klienta', () => {
    expect(RETURN_STATUS_LABELS).toEqual({
      requested: 'Zgłoszony – czekamy na paczkę',
      partially_received: 'Przyjęty częściowo',
      received: 'Paczka przyjęta',
      canceled: 'Anulowany',
    })
  })
})

describe('warsawDay', () => {
  it('dzień kalendarzowy w Europe/Warsaw, nie w UTC', () => {
    // 21:30 UTC = 23:30 in Warsaw (CEST, UTC+2)
    expect(warsawDay(new Date('2026-10-01T21:30:00Z'))).toBe('2026-10-01')
    // 22:30 UTC = 00:30 the next day in Warsaw
    expect(warsawDay(new Date('2026-10-01T22:30:00Z'))).toBe('2026-10-02')
    // winter (CET, UTC+1): 23:00 UTC is already the next day
    expect(warsawDay(new Date('2026-01-15T23:00:00Z'))).toBe('2026-01-16')
    expect(warsawDay(new Date('2026-01-15T22:59:59Z'))).toBe('2026-01-15')
  })
})

describe('returnLastDay', () => {
  const delivered = new Date('2026-10-01T21:30:00Z') // 23:30 on 1 Oct in Warsaw (CEST)

  it('dzień doręczenia się nie liczy, ostatni dzień terminu jest wliczony', () => {
    expect(returnLastDay(delivered, 30)).toBe('2026-10-31')
    expect(returnLastDay(delivered, 14)).toBe('2026-10-15')
  })

  it('doręczenie tuż po północy w Warszawie liczy się od następnego dnia', () => {
    // 22:30 UTC = 00:30 on 2 Oct in Warsaw
    expect(returnLastDay(new Date('2026-10-01T22:30:00Z'), 30)).toBe('2026-11-01')
  })

  it('zmiana czasu (25.10.2026) nie przesuwa terminu – liczą się dni, nie godziny', () => {
    expect(returnLastDay(new Date('2026-10-20T10:00:00Z'), 10)).toBe('2026-10-30')
    expect(returnLastDay(new Date('2026-03-20T10:00:00Z'), 14)).toBe('2026-04-03')
  })

  it('przechodzi przez koniec miesiąca i roku', () => {
    expect(returnLastDay(new Date('2026-12-20T10:00:00Z'), 30)).toBe('2027-01-19')
  })
})

describe('isReturnEligible', () => {
  const start = { source: 'delivered' as const, at: new Date('2026-10-01T21:30:00Z') }
  const input = { start, days: 30, now: new Date('2026-10-15T10:00:00Z'), canceled: false }

  it('ostatni dzień terminu do 23:59:59 w Warszawie (już czas zimowy) – można', () => {
    expect(isReturnEligible({ ...input, now: new Date('2026-10-31T22:59:59Z') })).toBe(true)
  })

  it('00:00 następnego dnia w Warszawie – już nie', () => {
    expect(isReturnEligible({ ...input, now: new Date('2026-10-31T23:00:00Z') })).toBe(false)
  })

  it('w trakcie terminu można, dzień doręczenia też', () => {
    expect(isReturnEligible(input)).toBe(true)
    expect(isReturnEligible({ ...input, now: new Date('2026-10-01T22:00:00Z') })).toBe(true)
  })

  it('krótszy termin z ustawienia zamyka okno wcześniej', () => {
    expect(isReturnEligible({ ...input, days: 14, now: new Date('2026-10-15T21:59:59Z') })).toBe(
      true,
    )
    expect(isReturnEligible({ ...input, days: 14, now: new Date('2026-10-15T22:00:00Z') })).toBe(
      false,
    )
  })

  it('bez początku terminu (nic nie wysłano) – nie', () => {
    expect(isReturnEligible({ ...input, start: null })).toBe(false)
  })

  it('anulowane zamówienie – nie, także w terminie', () => {
    expect(isReturnEligible({ ...input, canceled: true })).toBe(false)
  })
})

describe('returnWindowStart', () => {
  const at = (iso: string) => new Date(iso)

  it('tylko wysyłka – początek od wysyłki', () => {
    expect(
      returnWindowStart([
        { shippedAt: '2026-10-01T10:00:00Z', deliveredAt: null, canceledAt: null },
      ]),
    ).toEqual({ source: 'shipped', at: at('2026-10-01T10:00:00Z') })
  })

  it('doręczenie wygrywa z wysyłką tej samej realizacji', () => {
    expect(
      returnWindowStart([
        {
          shippedAt: at('2026-10-01T10:00:00Z'),
          deliveredAt: at('2026-10-03T12:00:00Z'),
          canceledAt: null,
        },
      ]),
    ).toEqual({ source: 'delivered', at: at('2026-10-03T12:00:00Z') })
  })

  it('dwie realizacje – liczy się najpóźniejszy start, razem ze swoim źródłem', () => {
    const early = {
      shippedAt: '2026-10-01T10:00:00Z',
      deliveredAt: '2026-10-02T10:00:00Z',
      canceledAt: null,
    }
    const lateShipped = { shippedAt: '2026-10-05T10:00:00Z', deliveredAt: null, canceledAt: null }
    expect(returnWindowStart([early, lateShipped])).toEqual({
      source: 'shipped',
      at: at('2026-10-05T10:00:00Z'),
    })
    expect(returnWindowStart([lateShipped, early])).toEqual({
      source: 'shipped',
      at: at('2026-10-05T10:00:00Z'),
    })

    const lateDelivered = {
      shippedAt: '2026-10-04T10:00:00Z',
      deliveredAt: '2026-10-08T10:00:00Z',
      canceledAt: null,
    }
    expect(returnWindowStart([early, lateDelivered, lateShipped])).toEqual({
      source: 'delivered',
      at: at('2026-10-08T10:00:00Z'),
    })
  })

  it('anulowana i bez wysyłki realizacje są pomijane', () => {
    const kept = { shippedAt: '2026-10-01T10:00:00Z', deliveredAt: null, canceledAt: null }
    expect(
      returnWindowStart([
        kept,
        {
          shippedAt: '2026-10-09T10:00:00Z',
          deliveredAt: '2026-10-10T10:00:00Z',
          canceledAt: '2026-10-11T10:00:00Z',
        },
        { shippedAt: null, deliveredAt: null, canceledAt: null },
      ]),
    ).toEqual({ source: 'shipped', at: at('2026-10-01T10:00:00Z') })
  })

  it('pusta lista i same realizacje bez wysyłki – null', () => {
    expect(returnWindowStart([])).toBeNull()
    expect(
      returnWindowStart([
        { shippedAt: null, deliveredAt: null, canceledAt: null },
        {
          shippedAt: '2026-10-01T10:00:00Z',
          deliveredAt: null,
          canceledAt: '2026-10-02T10:00:00Z',
        },
      ]),
    ).toBeNull()
  })
})

describe('returnableQuantity', () => {
  const base = { quantity: 2, shipped: 2, requested: 0, received: 0, dismissed: 0 }

  it('wysłane minus zgłoszone, przyjęte i odrzucone', () => {
    expect(returnableQuantity(base)).toBe(2)
    expect(returnableQuantity({ ...base, requested: 1 })).toBe(1)
    expect(returnableQuantity({ ...base, requested: 1, received: 1 })).toBe(0)
    expect(returnableQuantity({ ...base, received: 1, dismissed: 1 })).toBe(0)
  })

  it('przyjęta sztuka nie wraca do puli zwrotów', () => {
    expect(returnableQuantity({ ...base, shipped: 1, requested: 0, received: 1 })).toBe(0)
  })

  it('nic nie wysłano – 0, i nigdy ujemna', () => {
    expect(returnableQuantity({ ...base, shipped: 0 })).toBe(0)
    expect(returnableQuantity({ ...base, shipped: 1, requested: 2 })).toBe(0)
  })
})

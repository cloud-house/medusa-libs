import { RETURN_MESSAGES, RETURN_NOTE_MAX, type ReturnableItem } from '@cloud-house/commerce-rules'
import { describe, expect, it } from 'vitest'
import { checkReturnFormLocally, orderNumber, parseLookupForm, parseReturnForm } from './form'

function formOf(fields: Record<string, string>): FormData {
  const form = new FormData()
  for (const [name, value] of Object.entries(fields)) form.append(name, value)
  return form
}

const ORDER_ERROR = 'Podaj numer zamówienia z e-maila, np. 1001.'
const EMAIL_ERROR = 'Podaj adres e-mail z zamówienia.'

describe('parseLookupForm', () => {
  it.each(['1001', '#1001', ' CHNS-1001 ', 'chns-1001', '# 1001', '#CHNS-1001', 'CHNS- 1001'])(
    'numer „%s” – 1001',
    (order) => {
      expect(parseLookupForm(formOf({ order, email: 'anna@example.com' }), 'CHNS')).toEqual({
        ok: true,
        displayId: 1001,
        email: 'anna@example.com',
      })
    },
  )

  it('e-mail przez normalizeEmail: małe litery i bez spacji na brzegach', () => {
    expect(parseLookupForm(formOf({ order: '1001', email: '  Anna@Example.COM ' }))).toMatchObject({
      ok: true,
      email: 'anna@example.com',
    })
  })

  it.each(['abc', '', '10a1', 'CHNS-', '#', '0', '-5', '10.5', '12345678901', '2147483648'])(
    'numer „%s” – błąd numeru',
    (order) => {
      expect(parseLookupForm(formOf({ order, email: 'anna@example.com' }))).toEqual({
        ok: false,
        fieldErrors: { order: ORDER_ERROR },
        values: { order, email: 'anna@example.com' },
      })
    },
  )

  it('największy numer, jaki przyjmuje backend, przechodzi', () => {
    expect(parseLookupForm(formOf({ order: '2147483647', email: 'a@b.pl' }))).toMatchObject({
      ok: true,
      displayId: 2_147_483_647,
    })
  })

  it('zły e-mail – błąd e-maila, wpisane wartości wracają do pól', () => {
    expect(parseLookupForm(formOf({ order: '#1001', email: ' nie-email ' }))).toEqual({
      ok: false,
      fieldErrors: { email: EMAIL_ERROR },
      values: { order: '#1001', email: 'nie-email' },
    })
  })

  it('oba pola złe – oba błędy; brak pól w formularzu to puste wartości', () => {
    expect(parseLookupForm(new FormData())).toEqual({
      ok: false,
      fieldErrors: { order: ORDER_ERROR, email: EMAIL_ERROR },
      values: { order: '', email: '' },
    })
  })
})

const ITEMS: ReturnableItem[] = [
  { id: 'item_1', title: 'Leash spiralny', variant: 'czarny', thumbnail: null, returnable: 2 },
  { id: 'item_2', title: 'Pompka', variant: null, thumbnail: null, returnable: 1 },
]

describe('parseReturnForm', () => {
  it('poprawny formularz – pozycje z kodem powodu, pusta uwaga to null', () => {
    const form = formOf({
      'item:item_1': 'tak',
      'quantity:item_1': '1',
      'reason:item_1': 'size',
      note: '   ',
    })
    expect(parseReturnForm(form, ITEMS)).toEqual({
      ok: true,
      items: [{ id: 'item_1', quantity: 1, reason: 'size' }],
      note: null,
    })
  })

  it('kilka pozycji w kolejności zamówienia; przy returnable 1 ilość to 1 bez pola', () => {
    const form = formOf({
      'item:item_2': 'tak',
      'reason:item_2': 'defect',
      'item:item_1': 'tak',
      'quantity:item_1': '2',
      'reason:item_1': 'mind_changed',
      note: ' Pękła przy pierwszym użyciu. ',
    })
    expect(parseReturnForm(form, ITEMS)).toEqual({
      ok: true,
      items: [
        { id: 'item_1', quantity: 2, reason: 'mind_changed' },
        { id: 'item_2', quantity: 1, reason: 'defect' },
      ],
      note: 'Pękła przy pierwszym użyciu.',
    })
  })

  it('brak pola ilości przy returnable > 1 – jedna sztuka (nie więcej niż wybór domyślny)', () => {
    const form = formOf({ 'item:item_1': 'tak', 'reason:item_1': 'color' })
    expect(parseReturnForm(form, ITEMS)).toMatchObject({
      ok: true,
      items: [{ id: 'item_1', quantity: 1, reason: 'color' }],
    })
  })

  it('nic nie zaznaczone – komunikat o zaznaczeniu produktu', () => {
    const error = { ok: false, error: 'Zaznacz co najmniej jeden produkt do zwrotu.' }
    expect(parseReturnForm(new FormData(), ITEMS)).toEqual(error)
    // Powód i ilość bez zaznaczenia nic nie znaczą; zaznaczenie liczy się tylko wartością „tak”.
    expect(
      parseReturnForm(
        formOf({ 'reason:item_1': 'size', 'quantity:item_1': '1', 'item:item_2': 'on' }),
        ITEMS,
      ),
    ).toEqual(error)
  })

  it('zaznaczona pozycja bez powodu albo z nieznanym – komunikat o powodzie', () => {
    const noReason = formOf({ 'item:item_1': 'tak', 'quantity:item_1': '1' })
    expect(parseReturnForm(noReason, ITEMS)).toEqual({ ok: false, error: RETURN_MESSAGES.reason })
    const empty = formOf({ 'item:item_1': 'tak', 'reason:item_1': '' })
    expect(parseReturnForm(empty, ITEMS)).toEqual({ ok: false, error: RETURN_MESSAGES.reason })
    const unknown = formOf({ 'item:item_1': 'tak', 'reason:item_1': 'inne' })
    expect(parseReturnForm(unknown, ITEMS)).toEqual({ ok: false, error: RETURN_MESSAGES.reason })
  })

  it('ilość większa niż returnable – komunikat z tytułem i limitem', () => {
    const form = formOf({
      'item:item_1': 'tak',
      'quantity:item_1': '3',
      'reason:item_1': 'size',
    })
    expect(parseReturnForm(form, ITEMS)).toEqual({
      ok: false,
      error: 'Sprawdź ilość – możesz zwrócić najwyżej 2 szt. „Leash spiralny”.',
    })
  })

  it.each(['0', '-1', 'dwa', '1.5', '1e1', ' 2'])(
    'ilość „%s” poza zakresem – ten sam komunikat',
    (qty) => {
      const form = formOf({
        'item:item_1': 'tak',
        'quantity:item_1': qty,
        'reason:item_1': 'size',
      })
      expect(parseReturnForm(form, ITEMS)).toEqual({
        ok: false,
        error: 'Sprawdź ilość – możesz zwrócić najwyżej 2 szt. „Leash spiralny”.',
      })
    },
  )

  it('pozycje spoza listy z serwera są ignorowane (nie ufamy polom z przeglądarki)', () => {
    const form = formOf({
      'item:item_9': 'tak',
      'quantity:item_9': '5',
      'reason:item_9': 'size',
    })
    expect(parseReturnForm(form, ITEMS)).toEqual({
      ok: false,
      error: 'Zaznacz co najmniej jeden produkt do zwrotu.',
    })
  })

  it('uwaga najwyżej 500 znaków (po przycięciu; znak nowej linii liczy się za jeden)', () => {
    const base = { 'item:item_2': 'tak', 'reason:item_2': 'size' }
    const limit = 'a'.repeat(RETURN_NOTE_MAX)
    expect(parseReturnForm(formOf({ ...base, note: ` ${limit} ` }), ITEMS)).toMatchObject({
      ok: true,
      note: limit,
    })
    expect(parseReturnForm(formOf({ ...base, note: `${limit}a` }), ITEMS)).toEqual({
      ok: false,
      error: 'Uwagi mogą mieć najwyżej 500 znaków.',
    })
    const lines = `${'a'.repeat(249)}\r\n${'b'.repeat(250)}`
    expect(parseReturnForm(formOf({ ...base, note: lines }), ITEMS)).toMatchObject({
      ok: true,
      note: `${'a'.repeat(249)}\n${'b'.repeat(250)}`,
    })
  })

  it('błąd pozycji ma pierwszeństwo przed błędem uwagi, brak zaznaczenia przed oboma', () => {
    const tooLong = 'a'.repeat(RETURN_NOTE_MAX + 1)
    expect(parseReturnForm(formOf({ note: tooLong }), ITEMS)).toEqual({
      ok: false,
      error: 'Zaznacz co najmniej jeden produkt do zwrotu.',
    })
    expect(parseReturnForm(formOf({ 'item:item_2': 'tak', note: tooLong }), ITEMS)).toEqual({
      ok: false,
      error: RETURN_MESSAGES.reason,
    })
  })
})

describe('checkReturnFormLocally', () => {
  it('poprawny formularz – nic do zgłoszenia (ilości sprawdza dopiero serwer)', () => {
    const form = formOf({ 'item:item_1': 'tak', 'quantity:item_1': '999', 'reason:item_1': 'size' })
    expect(checkReturnFormLocally(form)).toBeNull()
  })

  it('nic nie zaznaczone – to samo, co powie parseReturnForm', () => {
    const message = 'Zaznacz co najmniej jeden produkt do zwrotu.'
    expect(checkReturnFormLocally(new FormData())).toBe(message)
    expect(checkReturnFormLocally(formOf({ 'reason:item_1': 'size', 'item:item_2': 'on' }))).toBe(
      message,
    )
  })

  it('zaznaczona pozycja bez powodu albo z nieznanym – komunikat o powodzie', () => {
    expect(checkReturnFormLocally(formOf({ 'item:item_1': 'tak' }))).toBe(RETURN_MESSAGES.reason)
    expect(checkReturnFormLocally(formOf({ 'item:item_1': 'tak', 'reason:item_1': 'inne' }))).toBe(
      RETURN_MESSAGES.reason,
    )
    // Jedna pozycja z powodem nie ratuje drugiej bez powodu.
    expect(
      checkReturnFormLocally(
        formOf({ 'item:item_1': 'tak', 'reason:item_1': 'size', 'item:item_2': 'tak' }),
      ),
    ).toBe(RETURN_MESSAGES.reason)
  })
})

describe('orderNumber – Review Focus 6c', () => {
  it('bez przedrostka sklepu: cyfry i # przechodzą, cudzy przedrostek nie', () => {
    expect(orderNumber(' #1001 ')).toBe(1001)
    expect(orderNumber('CHNS-1001')).toBeNull()
    expect(orderNumber('12345678901')).toBeNull()
  })

  it('przedrostek sklepu bez względu na wielkość liter i spacje', () => {
    expect(orderNumber('acme-1001', 'ACME')).toBe(1001)
    expect(orderNumber('# ACME- 1001', 'ACME')).toBe(1001)
    expect(orderNumber('CHNS-1001', 'ACME')).toBeNull()
  })

  it('znaki specjalne w przedrostku nie działają jak wyrażenie regularne', () => {
    expect(orderNumber('XY-1001', 'X.')).toBeNull()
    expect(orderNumber('X.-1001', 'X.')).toBe(1001)
  })

  it('parseLookupForm bez przedrostka odrzuca numer z cudzym przedrostkiem', () => {
    expect(parseLookupForm(formOf({ order: 'CHNS-1001', email: 'a@b.pl' }))).toMatchObject({
      ok: false,
      fieldErrors: { order: ORDER_ERROR },
    })
  })
})

describe('orderNumber – przegląd 6c', () => {
  it('przedrostek podany z myślnikiem (jak oidPrefix fakturowni) działa tak samo', () => {
    expect(orderNumber('ACME-1001', 'ACME-')).toBe(1001)
    expect(orderNumber('acme - 1001', 'ACME-')).toBe(1001)
  })

  it('przedrostek z samych spacji to brak przedrostka', () => {
    expect(orderNumber('-5', ' ')).toBeNull()
    expect(orderNumber('5', ' ')).toBe(5)
  })
})

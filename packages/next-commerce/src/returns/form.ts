import {
  isReturnReasonCode,
  RETURN_MESSAGES,
  RETURN_NOTE_MAX,
  type ReturnableItem,
  type ReturnClaimItemInput,
} from '@cloud-house/commerce-rules'
import { normalizeEmail } from '../newsletter/email'

export const RETURN_FORM_MESSAGES = {
  order: 'Podaj numer zamówienia z e-maila, np. 1001.',
  email: 'Podaj adres e-mail z zamówienia.',
  nothingPicked: 'Zaznacz co najmniej jeden produkt do zwrotu.',
  note: `Uwagi mogą mieć najwyżej ${RETURN_NOTE_MAX} znaków.`,
} as const

export type LookupFields = { order: string; email: string }

export type LookupParse =
  | { ok: true; displayId: number; email: string }
  | { ok: false; fieldErrors: { order?: string; email?: string }; values: LookupFields }

/** Największy numer, jaki przyjmuje backend (największa liczba całkowita PostgreSQL). */
const MAX_DISPLAY_ID = 2_147_483_647

const text = (form: FormData, name: string) => {
  const value = form.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Numer z maila: „1001”, „#1001”, a przy `orderPrefix` sklepu (np. `ACME`) także „ACME-1001”
 * (spacje i wielkość liter bez znaczenia) → 1001. Cokolwiek innego niż cyfry po zdjęciu `#`
 * i przedrostka to `null`.
 */
export function orderNumber(value: string, orderPrefix?: string): number | null {
  let digits = value.replace(/\s+/g, '').replace(/^#/, '')
  // `ACME` and `ACME-` (the style of fakturownia's `oidPrefix`) mean the same; only spaces – none.
  const prefix = (orderPrefix ?? '').replace(/\s+/g, '').replace(/-+$/, '')
  if (prefix) digits = digits.replace(new RegExp(`^${escapeRegExp(prefix)}-`, 'i'), '')
  if (!/^\d{1,10}$/.test(digits)) return null
  const number = Number(digits)
  return number >= 1 && number <= MAX_DISPLAY_ID ? number : null
}

/** Formularz „Znajdź zamówienie” gościa: numer zamówienia i adres e-mail z zamówienia. */
export function parseLookupForm(form: FormData, orderPrefix?: string): LookupParse {
  const values = { order: text(form, 'order'), email: text(form, 'email') }
  const displayId = orderNumber(values.order, orderPrefix)
  const email = normalizeEmail(values.email)
  if (displayId !== null && email !== null) return { ok: true, displayId, email }
  return {
    ok: false,
    fieldErrors: {
      ...(displayId === null && { order: RETURN_FORM_MESSAGES.order }),
      ...(email === null && { email: RETURN_FORM_MESSAGES.email }),
    },
    values,
  }
}

export type ReturnParse =
  | { ok: true; items: ReturnClaimItemInput[]; note: string | null }
  | { ok: false; error: string }

/** Ilość z pola formularza: brak pola (jedna sztuka do zwrotu) to 1, nie-liczba to `null`. */
function quantityOf(value: FormDataEntryValue | null): number | null {
  if (value === null || value === '') return 1
  return typeof value === 'string' && /^\d{1,3}$/.test(value) ? Number(value) : null
}

/**
 * Błędy, które widać z samego formularza, bez świeżych danych z serwera: nic nie zaznaczono albo
 * zaznaczona pozycja nie ma powodu z listy. Akcje sprawdzają je przed limitem prób – pomyłka
 * w formularzu nie kosztuje próby. Komunikaty jak w `parseReturnForm`; ilości (granice z serwera)
 * i uwagi sprawdza dopiero on.
 */
export function checkReturnFormLocally(form: FormData): string | null {
  const picked = [...form.keys()].filter(
    (name) => name.startsWith('item:') && form.get(name) === 'tak',
  )
  if (picked.length === 0) return RETURN_FORM_MESSAGES.nothingPicked
  const noReason = picked.some((name) => !isReturnReasonCode(form.get(`reason:${name.slice(5)}`)))
  return noReason ? RETURN_MESSAGES.reason : null
}

/**
 * Pola `item:{id}` (`tak`), `quantity:{id}`, `reason:{id}` i `note` → pozycje zgłoszenia. Pozycje
 * i limity ilości pochodzą z `items` (świeże dane z serwera) – z przeglądarki liczy się tylko to,
 * co klient zaznaczył i wybrał w granicach tej listy.
 */
export function parseReturnForm(form: FormData, items: ReturnableItem[]): ReturnParse {
  const picked = items.filter((item) => form.get(`item:${item.id}`) === 'tak')
  if (picked.length === 0) return { ok: false, error: RETURN_FORM_MESSAGES.nothingPicked }

  const lines: ReturnClaimItemInput[] = []
  for (const item of picked) {
    const reason = form.get(`reason:${item.id}`)
    if (!isReturnReasonCode(reason)) return { ok: false, error: RETURN_MESSAGES.reason }
    const quantity = quantityOf(form.get(`quantity:${item.id}`))
    if (quantity === null || quantity < 1 || quantity > item.returnable) {
      return {
        ok: false,
        error: `Sprawdź ilość – możesz zwrócić najwyżej ${item.returnable} szt. „${item.title}”.`,
      }
    }
    lines.push({ id: item.id, quantity, reason })
  }

  // Przeglądarka liczy nowy wiersz jako jeden znak, a w treści formularza bywa „\r\n”.
  const note = text(form, 'note').replace(/\r\n?/g, '\n')
  if (note.length > RETURN_NOTE_MAX) return { ok: false, error: RETURN_FORM_MESSAGES.note }
  return { ok: true, items: lines, note: note || null }
}

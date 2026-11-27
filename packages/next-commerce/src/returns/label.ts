/** Numer zamówienia z adresu etykiety: do 10 cyfr, bez żadnych innych znaków. */
const ORDER_NUMBER = /^\d{1,10}$/

/**
 * Numer zamówienia z parametru `?zamowienie=` strony etykiety (pierwsza wartość powtórzonego
 * parametru, `#` z przodu zdejmowany). Trafia na wydruk, więc przechodzi wyłącznie biała lista
 * cyfr – cokolwiek innego to `null` i etykieta ma linię do wpisania.
 */
export function labelOrderNumber(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string') return null
  const number = raw.trim().replace(/^#/, '')
  return ORDER_NUMBER.test(number) ? number : null
}

/** Adres etykiety zwrotu do zamówienia o numerze `displayId` (link z maila i z potwierdzenia). */
export function labelHref(displayId: number): string {
  return `/zwrot/etykieta?zamowienie=${displayId}`
}

/** Mobile number prefixes in Poland (first two digits of the nine-digit number). */
export const MOBILE_PREFIXES = [
  '45',
  '50',
  '51',
  '53',
  '57',
  '60',
  '66',
  '69',
  '72',
  '73',
  '78',
  '79',
  '88',
] as const

/**
 * A Polish mobile number: nine digits starting with a mobile prefix, optionally with `+48` or
 * `0048` in front and spaces, dashes or brackets between the digits. A parcel locker sends the
 * pick-up code to it by SMS.
 */
export function isPolishMobile(phone: string | null | undefined): boolean {
  if (!phone) return false
  const digits = phone.replace(/[\s\-()]/g, '').replace(/^(?:\+48|0048)/, '')
  return /^\d{9}$/.test(digits) && MOBILE_PREFIXES.some((prefix) => digits.startsWith(prefix))
}

export const MOBILE_FOR_LOCKER =
  'Do paczkomatu potrzebny jest numer komórkowy – przyjdzie na niego kod odbioru.'

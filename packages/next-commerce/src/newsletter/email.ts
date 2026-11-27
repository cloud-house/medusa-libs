/** Najdłuższy adres e-mail według RFC 5321 (ścieżka SMTP). */
export const MAX_EMAIL_LENGTH = 254

// Część lokalna bez spacji i „..”, jedna małpa, domena z kropką i literową końcówką (min. 2 znaki).
const EMAIL =
  /^(?!.*\.\.)[a-z0-9!#$%&'*+/=?^_`{|}~-](?:[a-z0-9!#$%&'*+/=?^_`{|}~.-]*[a-z0-9!#$%&'*+/=?^_`{|}~-])?@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/

/** Adres do zapisu na newsletter: przycięty, małymi literami; `null`, gdy nie wygląda na e-mail. */
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  if (email === '' || email.length > MAX_EMAIL_LENGTH) return null
  return EMAIL.test(email) ? email : null
}

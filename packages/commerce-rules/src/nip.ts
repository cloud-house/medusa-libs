const WEIGHTS = [6, 5, 7, 2, 3, 4, 5, 6, 7]

/** Digits only: drops spaces, dashes and the `PL` prefix. */
export function normalizeNip(value: string): string {
  return value.replace(/^\s*PL/i, '').replace(/[\s-]/g, '')
}

/** Polish tax id (NIP): 10 digits with the official checksum. */
export function isValidNip(value: string): boolean {
  const nip = normalizeNip(value)
  if (!/^\d{10}$/.test(nip) || /^0+$/.test(nip)) return false
  const digits = [...nip].map(Number)
  const sum = WEIGHTS.reduce((total, weight, i) => total + weight * (digits[i] ?? 0), 0)
  const check = sum % 11
  return check !== 10 && check === digits[9]
}

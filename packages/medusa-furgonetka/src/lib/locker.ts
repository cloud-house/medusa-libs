/** Parcel locker code (e.g. `KRA01M`) in upper case, or `null` when it does not look like one. */
export function normalizeLockerCode(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const code = value.trim().toUpperCase()
  return /^[A-Z0-9-]{4,12}$/.test(code) ? code : null
}

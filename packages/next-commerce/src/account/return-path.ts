const BASE = 'https://sklep.invalid'
// Przeglądarki wycinają z adresu tabulatory i nowe linie, więc `/\t/evil.com` staje się
// `//evil.com` – znaki sterujące odrzucamy w całości.
const hasControl = (value: string) =>
  [...value].some((char) => char.charCodeAt(0) < 0x20 || char.charCodeAt(0) === 0x7f)

/** Only a path of this shop – `?powrot=` must never send the customer to another site. */
export function safeReturnPath(value: unknown, fallback = '/konto'): string {
  if (typeof value !== 'string' || hasControl(value)) return fallback
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback
  try {
    const url = new URL(value, BASE)
    if (url.origin !== BASE) return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}

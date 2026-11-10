import { normalizeNip } from './nip'

/** Seller data from the store settings (group „Dane sprzedawcy”). */
export interface SellerInfo {
  companyName: string | null
  street: string | null
  postalCode: string | null
  city: string | null
  nip: string | null
  regon: string | null
  registry: string | null
  /** Multi-line; empty means the company address. */
  returnAddress: string | null
}

export const EMPTY_SELLER: SellerInfo = {
  companyName: null,
  street: null,
  postalCode: null,
  city: null,
  nip: null,
  regon: null,
  registry: null,
  returnAddress: null,
}

/** The „Dane sprzedawcy” group as saved: trimmed text, anything else (or empty) – `null`. */
export function toSellerInfo(raw: unknown): SellerInfo {
  const group = (raw ?? {}) as Partial<Record<keyof SellerInfo, unknown>>
  const text = (key: keyof SellerInfo) => {
    const value = group[key]
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
  }
  return {
    companyName: text('companyName'),
    street: text('street'),
    postalCode: text('postalCode'),
    city: text('city'),
    nip: text('nip'),
    regon: text('regon'),
    registry: text('registry'),
    returnAddress: text('returnAddress'),
  }
}

const filled = (value: string | null | undefined): value is string => Boolean(value?.trim())

/** Company, street, postal code, city and NIP are all filled in. */
export function isSellerComplete(seller: SellerInfo | null | undefined): seller is SellerInfo {
  return Boolean(
    seller &&
      filled(seller.companyName) &&
      filled(seller.street) &&
      filled(seller.postalCode) &&
      filled(seller.city) &&
      filled(seller.nip),
  )
}

/** „ul. Morska 5, 80-001 Gdańsk”; `null` without the street, postal code or city. */
export function sellerAddress(seller: SellerInfo): string | null {
  if (!filled(seller.street) || !filled(seller.postalCode) || !filled(seller.city)) return null
  return `${seller.street.trim()}, ${seller.postalCode.trim()} ${seller.city.trim()}`
}

/** „Acme sp. z o.o., ul. Morska 5, 80-001 Gdańsk, NIP 5260250274”; `null` when incomplete. */
export function sellerLine(seller: SellerInfo | null | undefined): string | null {
  if (!isSellerComplete(seller)) return null
  return `${seller.companyName?.trim()}, ${sellerAddress(seller)}, NIP ${normalizeNip(seller.nip ?? '')}`
}

/** Return address in one line – the separate one, else the company with its address. */
export function returnAddressText(seller: SellerInfo | null | undefined): string | null {
  if (!seller) return null
  if (filled(seller.returnAddress)) {
    return seller.returnAddress
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join(', ')
  }
  return isSellerComplete(seller) ? `${seller.companyName?.trim()}, ${sellerAddress(seller)}` : null
}

/**
 * Return address as printable lines – the separate one (trimmed, blank lines dropped), else
 * `[company, street, '{postalCode} {city}']` of complete seller data, else `null`.
 */
export function returnAddressLines(seller: SellerInfo | null | undefined): string[] | null {
  if (!seller) return null
  if (filled(seller.returnAddress)) {
    return seller.returnAddress
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  }
  if (!isSellerComplete(seller)) return null
  return [
    seller.companyName?.trim() ?? '',
    seller.street?.trim() ?? '',
    `${seller.postalCode?.trim()} ${seller.city?.trim()}`,
  ]
}

/** Polish postal code: 00-000. */
export function isValidPostalCode(value: string): boolean {
  return /^\d{2}-\d{3}$/.test(value.trim())
}

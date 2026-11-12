const NBSP = ' '
const MINUS = '−'

export interface FormatPriceOptions {
  /** ISO 4217 currency code. Default `PLN`. */
  currency?: string
  /** BCP 47 locale. Default `pl`. */
  locale?: string
}

/**
 * Formats an amount given in major units (Medusa v2 stores prices in major units, not minor).
 * PLN + Polish (`pl`, `pl-PL`, any `pl-*`, case-insensitive) keeps a hand-written path: the pl Intl locale does not group 4-digit numbers
 * ("1899 zł"), while the design uses "1 899 zł". Every other pair goes through Intl.NumberFormat.
 */
export function formatPrice(amount: number, options: FormatPriceOptions = {}): string {
  const { currency = 'PLN', locale = 'pl' } = options
  if (!Number.isFinite(amount)) {
    throw new RangeError(`Cannot format a non-finite price: ${amount}`)
  }
  if (currency.toUpperCase() !== 'PLN' || !/^pl(-|$)/i.test(locale)) {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
  }

  const grosze = Math.round(Math.abs(amount) * 100)
  const zloty = Math.floor(grosze / 100)
  const rest = grosze % 100

  const sign = amount < 0 && grosze > 0 ? MINUS : ''
  const zlotyText = String(zloty).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
  const restText = rest === 0 ? '' : `,${String(rest).padStart(2, '0')}`

  return `${sign}${zlotyText}${restText}${NBSP}zł`
}

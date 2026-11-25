import type { Carrier } from '../types'

// The names live in `types.ts`, which has no server imports, so the admin panel can use them too.
import { CARRIER_NAMES } from '../types'

export { CARRIER_NAMES }

/** The shop's codes of the two InPost delivery options (`deliveryCodes` option). */
export interface DeliveryCodes {
  inpostCourier: string
  inpostLocker: string
}

/** „tylko kurierem DPD” for DPD alone, else „tylko: Kurier DPD, Kurier InPost” – the carriers a bulky class allows. */
export function onlyCarriersText(allowed: Carrier[]): string {
  return allowed.length === 1 && allowed[0] === 'dpd'
    ? 'tylko kurierem DPD'
    : `tylko: ${allowed.map((carrier) => CARRIER_NAMES[carrier]).join(', ')}`
}

/** The carrier of a delivery option code (`shipping_option_type.code`); DPD for anything else. */
export function carrierForCode(code: string | null, codes: DeliveryCodes): Carrier {
  if (code === codes.inpostCourier) return 'inpost_courier'
  if (code === codes.inpostLocker) return 'inpost_locker'
  return 'dpd'
}

/**
 * The value when it is an `http(s)` link a browser can open, else `null`. The Medusa admin sends
 * `#` for a link the operator left empty, and a href must never take `javascript:` or the like.
 */
export function httpUrl(value: string | null | undefined): string | null {
  const url = value?.trim()
  if (!url) return null
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol) ? url : null
  } catch {
    return null
  }
}

/** The carrier's public tracking page for a parcel number (spec 6d §5.6). */
export function trackingUrl(carrier: Carrier, number: string): string {
  const nr = encodeURIComponent(number)
  return carrier === 'dpd'
    ? `https://tracktrace.dpd.com.pl/parcelDetails?typ=1&p1=${nr}`
    : `https://inpost.pl/sledzenie-przesylek?number=${nr}`
}

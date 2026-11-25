import type { ShopContact } from '@cloud-house/medusa-emails'
import type { MedusaContainer } from '@medusajs/framework/types'
import { FURGONETKA_ERROR_CODES, furgonetkaError } from './errors'
import { metadataParcelClasses } from './lib/metadata-parcel-classes'
import { ACCESSORIES_PURPOSES, type Carrier, type ShippingOrderSource } from './types'

/** The shop's contact data with the address replies to the shipment e-mail go to. */
export type FurgonetkaContact = ShopContact & { replyTo?: string | null }

/**
 * A kind of bulky item (a board, a sofa…): every piece gets its own carton, from the template whose
 * purpose is the class key, and only the listed carriers take it (default: DPD).
 */
export interface ParcelClass {
  /** `[a-z0-9_]{1,40}`; also the `purpose` of the class's parcel template. */
  key: string
  /** The name in the panel. */
  label: string
  /** Carriers that take the class; default `['dpd']`. */
  carriers?: Carrier[]
}

/** `plugins: [{ resolve: '@cloud-house/medusa-furgonetka', options }]` in `medusa-config.ts`. */
export interface FurgonetkaOptions {
  /** The order as shipping sees it, without the parcel classes of the items; `null` when there is none. Required. */
  resolveOrder: (container: MedusaContainer, orderId: string) => Promise<ShippingOrderSource | null>
  /** The shop's contact data for the shipment e-mail and the alerts. */
  resolveContact?: (container: MedusaContainer) => Promise<FurgonetkaContact | null>
  /** The shop's bulky kinds, in the order the cartons are planned. Required, at least one. */
  parcelClasses: ParcelClass[]
  /** Product id → class key for the given products; default reads `product.metadata.parcel_class`. */
  resolveParcelClasses?: (
    container: MedusaContainer,
    productIds: string[],
  ) => Promise<Map<string, string>>
  /** `shipping_option_type.code` of the InPost delivery options; default `kurier-inpost` and `paczkomat-inpost`. */
  deliveryCodes?: { inpostCourier?: string; inpostLocker?: string }
  /** The sender's name on labels; default `Shop`. */
  senderName?: string
  /** The stock location the shipments go from; default the first one with an address. */
  stockLocationName?: string | null
  /** Prefix of the log lines; default `[Furgonetka]`. */
  logPrefix?: string
  /** Path of an order in the customer account (`:id` = order id); default `/account/orders/:id`. */
  accountOrderPath?: string
}

export interface ResolvedFurgonetkaOptions {
  resolveOrder: FurgonetkaOptions['resolveOrder']
  resolveContact: NonNullable<FurgonetkaOptions['resolveContact']> | null
  parcelClasses: (ParcelClass & { carriers: Carrier[] })[]
  resolveParcelClasses: NonNullable<FurgonetkaOptions['resolveParcelClasses']>
  deliveryCodes: { inpostCourier: string; inpostLocker: string }
  senderName: string
  stockLocationName: string | null
  logPrefix: string
  accountOrderPath: string
}

/** `values` without the keys set to `undefined` (a spread would let them wipe a default). */
export const withoutUndefined = <T extends object>(values: T | undefined): Partial<T> =>
  Object.fromEntries(
    Object.entries(values ?? {}).filter(([, value]) => value !== undefined),
  ) as Partial<T>

const CARRIERS: readonly string[] = ['dpd', 'inpost_courier', 'inpost_locker']
const CLASS_KEY = /^[a-z0-9_]{1,40}$/

function checkClasses(classes: unknown): (ParcelClass & { carriers: Carrier[] })[] {
  if (classes === undefined) {
    throw furgonetkaError(
      FURGONETKA_ERROR_CODES.missingOption,
      'option "parcelClasses" is required (at least one class).',
    )
  }
  if (!Array.isArray(classes) || classes.length === 0) {
    throw furgonetkaError(
      FURGONETKA_ERROR_CODES.invalidOption,
      'option "parcelClasses" needs at least one class.',
    )
  }
  const seen = new Set<string>()
  return classes.map((entry: ParcelClass) => {
    const { key, label, carriers = ['dpd'] } = entry ?? ({} as ParcelClass)
    const invalid = (reason: string) =>
      furgonetkaError(FURGONETKA_ERROR_CODES.invalidOption, `parcelClasses: ${reason}.`)
    if (typeof key !== 'string' || !CLASS_KEY.test(key)) {
      throw invalid(`key "${String(key)}" must match [a-z0-9_]{1,40}`)
    }
    if ((ACCESSORIES_PURPOSES as readonly string[]).includes(key)) {
      throw invalid(`key "${key}" is reserved`)
    }
    if (seen.has(key)) throw invalid(`key "${key}" is repeated`)
    seen.add(key)
    if (typeof label !== 'string' || !label.trim()) throw invalid(`class "${key}" needs a label`)
    if (
      !Array.isArray(carriers) ||
      carriers.length === 0 ||
      carriers.some((c) => !CARRIERS.includes(c))
    ) {
      throw invalid(`class "${key}": carriers must be some of ${CARRIERS.join(', ')}`)
    }
    return { key, label: label.trim(), carriers: [...carriers] }
  })
}

/** Options with the defaults filled in (`undefined` values count as unset); throws when a required one is wrong. */
export function resolveOptions(options: FurgonetkaOptions): ResolvedFurgonetkaOptions {
  const given = withoutUndefined(options)
  if (typeof given.resolveOrder !== 'function') {
    throw furgonetkaError(
      FURGONETKA_ERROR_CODES.missingOption,
      'option "resolveOrder" is required (a function).',
    )
  }
  const parcelClasses = checkClasses(given.parcelClasses)
  const {
    resolveContact = null,
    resolveParcelClasses = metadataParcelClasses,
    senderName = 'Shop',
    stockLocationName = null,
    logPrefix = '[Furgonetka]',
    accountOrderPath = '/account/orders/:id',
  } = given
  const codes = withoutUndefined(given.deliveryCodes)
  if (!accountOrderPath.includes(':id')) {
    throw furgonetkaError(
      FURGONETKA_ERROR_CODES.invalidOption,
      `option "accountOrderPath" must contain ":id" (got "${accountOrderPath}").`,
    )
  }
  return {
    resolveOrder: given.resolveOrder,
    resolveContact,
    parcelClasses,
    resolveParcelClasses,
    deliveryCodes: {
      inpostCourier: codes.inpostCourier ?? 'kurier-inpost',
      inpostLocker: codes.inpostLocker ?? 'paczkomat-inpost',
    },
    senderName,
    stockLocationName,
    logPrefix,
    accountOrderPath,
  }
}

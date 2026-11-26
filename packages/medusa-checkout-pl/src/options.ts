import type { DeliveryReview, OrderSummaryItem } from '@cloud-house/commerce-rules'
import type { MedusaContainer } from '@medusajs/framework/types'
import { CHECKOUT_PL_ERROR_CODES, checkoutPlError } from './errors'
import type { BlockReason, CheckoutContact } from './types'

/** The codes (`shipping_option_type.code`) of the delivery methods the rules know. */
export interface DeliveryCodes {
  /** InPost courier; closed for items with a parcel class. Default `kurier-inpost`. */
  inpostCourier: string
  /** InPost parcel locker; closed for items with a parcel class. Default `paczkomat-inpost`. */
  inpostLocker: string
  /** The courier bulky items go by. Default `kurier-dpd`. */
  courier: string
}

/** Customer-facing texts of the checkout check; the defaults are Polish. */
export interface CheckoutTexts {
  lockerBlocked: string
  lockerMissing: string
  courierBlocked: string
}

/** A line with the lines attached to it (e.g. upgrades bought for a board). */
export interface LineGroup<T> {
  line: T
  upgrades: T[]
}

/** `plugins: [{ resolve: '@cloud-house/medusa-checkout-pl', options }]` in `medusa-config.ts`. */
export interface CheckoutPlOptions {
  /** The shop's contact data (e-mail, phone, hours, seller line); may resolve to `null`. Required. */
  resolveContact: (
    container: MedusaContainer,
    /** Present when the contact is read for an order's e-mail: warnings logged here name the order. */
    context?: { logger: { warn(message: string): void } },
  ) => Promise<CheckoutContact | null>
  /** Variant id → a short label for the e-mail (e.g. „Turkus · 10'6"”); default none (the variant title is shown). */
  variantLabels?: (container: MedusaContainer, variantIds: string[]) => Promise<Map<string, string>>
  /** Groups the order lines for the e-mail; default every line on its own. */
  groupLines?: (items: OrderSummaryItem[]) => LineGroup<OrderSummaryItem>[]
  deliveryCodes?: Partial<DeliveryCodes>
  /** Order of the delivery options at checkout (codes); default InPost courier, courier, parcel locker. */
  deliveryOrder?: string[]
  /** Why the parcel locker / the InPost courier is closed for bulky items; default „<product> nie mieści się w paczkomacie.” */
  blockReasons?: Partial<{ locker: BlockReason; inpostCourier: BlockReason }>
  texts?: Partial<CheckoutTexts>
  /** Notes of the order e-mail for a reviewed delivery (the storefront's confirmation page has its own copy). */
  deliveryReviewNotes?: Partial<Record<DeliveryReview, string>>
  /** Currency of the shop's single region; default `pln`. */
  currency?: string
  /** Env variable with the storefront address; default `STOREFRONT_URL`. */
  storefrontUrlEnv?: string
  /** Env variable with the Reply-To address of customer e-mails; default `EMAIL_REPLY_TO`. */
  replyToEnv?: string
  /** Prefix of the log lines; default `[Checkout]`. */
  logPrefix?: string
}

export interface ResolvedCheckoutPlOptions {
  resolveContact: CheckoutPlOptions['resolveContact']
  variantLabels: CheckoutPlOptions['variantLabels'] | null
  groupLines: NonNullable<CheckoutPlOptions['groupLines']> | null
  deliveryCodes: DeliveryCodes
  deliveryOrder: string[]
  blockReasons: { locker: BlockReason | null; inpostCourier: BlockReason | null }
  texts: CheckoutTexts
  deliveryReviewNotes: Partial<Record<DeliveryReview, string>>
  currency: string
  storefrontUrlEnv: string
  replyToEnv: string
  logPrefix: string
}

/** `values` without the keys set to `undefined` (a spread would let them wipe a default). */
export const withoutUndefined = <T extends object>(values: T | undefined): Partial<T> =>
  Object.fromEntries(
    Object.entries(values ?? {}).filter(([, value]) => value !== undefined),
  ) as Partial<T>

const DEFAULT_CODES: DeliveryCodes = {
  inpostCourier: 'kurier-inpost',
  inpostLocker: 'paczkomat-inpost',
  courier: 'kurier-dpd',
}

const DEFAULT_TEXTS: CheckoutTexts = {
  lockerBlocked: 'Paczkomat jest niedostępny dla tych produktów – wybierz kuriera.',
  lockerMissing: 'Wybierz paczkomat.',
  courierBlocked: 'Kurier InPost jest niedostępny dla tych produktów – wybierz Kuriera DPD.',
}

const invalid = (message: string) => checkoutPlError(CHECKOUT_PL_ERROR_CODES.invalidOption, message)
const text = (value: unknown) => typeof value === 'string' && value.trim() !== ''

/** Options with the defaults filled in (`undefined` values count as unset); throws when one is wrong. */
export function resolveOptions(options: CheckoutPlOptions): ResolvedCheckoutPlOptions {
  const given = withoutUndefined(options)
  if (typeof given.resolveContact !== 'function') {
    throw checkoutPlError(
      CHECKOUT_PL_ERROR_CODES.missingOption,
      'option "resolveContact" is required (a function).',
    )
  }
  const deliveryCodes = { ...DEFAULT_CODES, ...withoutUndefined(given.deliveryCodes) }
  for (const [key, value] of Object.entries(deliveryCodes)) {
    if (!text(value)) throw invalid(`option "deliveryCodes.${key}" must be a non-empty text.`)
  }
  const deliveryOrder = given.deliveryOrder ?? [
    deliveryCodes.inpostCourier,
    deliveryCodes.courier,
    deliveryCodes.inpostLocker,
  ]
  if (!Array.isArray(deliveryOrder) || !deliveryOrder.every(text)) {
    throw invalid('option "deliveryOrder" must be a list of delivery codes.')
  }
  const currency = given.currency ?? 'pln'
  if (!text(currency)) throw invalid('option "currency" must be a non-empty text.')
  const functions: [string, unknown][] = [
    ['variantLabels', given.variantLabels],
    ['groupLines', given.groupLines],
    ['blockReasons.locker', given.blockReasons?.locker],
    ['blockReasons.inpostCourier', given.blockReasons?.inpostCourier],
  ]
  for (const [name, value] of functions) {
    if (value !== undefined && typeof value !== 'function') {
      throw invalid(`option "${name}" must be a function.`)
    }
  }
  const texts = { ...DEFAULT_TEXTS, ...withoutUndefined(given.texts) }
  for (const [key, value] of Object.entries(texts)) {
    if (!text(value)) throw invalid(`option "texts.${key}" must be a non-empty text.`)
  }
  const strings: [string, unknown][] = [
    ['logPrefix', given.logPrefix ?? '[Checkout]'],
    ['storefrontUrlEnv', given.storefrontUrlEnv ?? 'STOREFRONT_URL'],
    ['replyToEnv', given.replyToEnv ?? 'EMAIL_REPLY_TO'],
  ]
  for (const [name, value] of strings) {
    if (!text(value)) throw invalid(`option "${name}" must be a non-empty text.`)
  }
  return {
    resolveContact: given.resolveContact,
    variantLabels: given.variantLabels ?? null,
    groupLines: given.groupLines ?? null,
    deliveryCodes,
    deliveryOrder: [...deliveryOrder],
    blockReasons: {
      locker: given.blockReasons?.locker ?? null,
      inpostCourier: given.blockReasons?.inpostCourier ?? null,
    },
    texts,
    deliveryReviewNotes: { ...withoutUndefined(given.deliveryReviewNotes) },
    currency,
    storefrontUrlEnv: given.storefrontUrlEnv ?? 'STOREFRONT_URL',
    replyToEnv: given.replyToEnv ?? 'EMAIL_REPLY_TO',
    logPrefix: given.logPrefix ?? '[Checkout]',
  }
}

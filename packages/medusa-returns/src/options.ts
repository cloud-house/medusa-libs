import type { MedusaContainer } from '@medusajs/framework/types'
import { RETURNS_ERROR_CODES, returnsError } from './errors'
import type { ReturnContact, ReturnOrder } from './types'

/** `plugins: [{ resolve: '@cloud-house/medusa-returns', options }]` in `medusa-config.ts`. */
export interface ReturnsOptions {
  /** The order as returns see it; `null` when there is no such order. Required. */
  resolveOrder: (container: MedusaContainer, orderId: string) => Promise<ReturnOrder | null>
  /** The shop's contact data and return rules (window, return address). Required; may resolve to `null`. */
  resolveContact: (container: MedusaContainer) => Promise<ReturnContact | null>
  /** Prefix of the log lines; default `[Returns]`. */
  logPrefix?: string
  /** Path of the return label page (`:displayId` = order number); default `/returns/label?order=:displayId`. */
  labelPath?: string
  /** Path of an order in the customer account (`:id` = order id); default `/account/orders/:id`. */
  accountOrderPath?: string
  /**
   * Shop-specific advice in the e-mails; every part is optional and omitted from the e-mail when
   * not given (the plugin knows nothing about what the shop sells).
   */
  emailCopy?: ReturnEmailCopy
}

/** Sentences the shop adds to the return e-mails. */
export interface ReturnEmailCopy {
  /** Customer e-mail, after „Bezpośredni koszt odesłania Towaru ponosi Kupujący.” – how to ship the goods. */
  shippingHint?: string | null
  /** Customer e-mail, a small paragraph under the shipping advice – how to pack the goods. */
  packingHint?: string | null
  /** Shop alert, after „przyjmij zwrot w zamówieniu w panelu Medusy – …” (e.g. that a credit note follows). */
  afterReceiveHint?: string | null
}

export type ResolvedReturnsOptions = Required<Omit<ReturnsOptions, 'emailCopy'>> & {
  emailCopy: Required<ReturnEmailCopy>
}

/** `values` without the keys set to `undefined` (a spread would let them wipe a default). */
export const withoutUndefined = <T extends object>(values: T | undefined): Partial<T> =>
  Object.fromEntries(
    Object.entries(values ?? {}).filter(([, value]) => value !== undefined),
  ) as Partial<T>

const REQUIRED = ['resolveOrder', 'resolveContact'] as const

/** Options with the defaults filled in (`undefined` values count as unset); throws when a required one is wrong. */
export function resolveOptions(options: ReturnsOptions): ResolvedReturnsOptions {
  const given = withoutUndefined(options)
  for (const key of REQUIRED) {
    if (typeof given[key] !== 'function') {
      throw returnsError(
        RETURNS_ERROR_CODES.missingOption,
        `option "${key}" is required (a function).`,
      )
    }
  }
  const {
    logPrefix = '[Returns]',
    labelPath = '/returns/label?order=:displayId',
    accountOrderPath = '/account/orders/:id',
    emailCopy,
  } = given
  if (!accountOrderPath.includes(':id')) {
    throw returnsError(
      RETURNS_ERROR_CODES.invalidOption,
      `option "accountOrderPath" must contain ":id" (got "${accountOrderPath}").`,
    )
  }
  if (!labelPath.includes(':displayId')) {
    throw returnsError(
      RETURNS_ERROR_CODES.invalidOption,
      `option "labelPath" must contain ":displayId" (got "${labelPath}").`,
    )
  }
  return {
    resolveOrder: given.resolveOrder as ReturnsOptions['resolveOrder'],
    resolveContact: given.resolveContact as ReturnsOptions['resolveContact'],
    logPrefix,
    labelPath,
    accountOrderPath,
    emailCopy: {
      shippingHint: emailCopy?.shippingHint ?? null,
      packingHint: emailCopy?.packingHint ?? null,
      afterReceiveHint: emailCopy?.afterReceiveHint ?? null,
    },
  }
}

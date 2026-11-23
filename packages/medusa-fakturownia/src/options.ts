import type { MedusaContainer } from '@medusajs/framework/types'
import { FAKTUROWNIA_ERROR_CODES } from './errors'
import type { InvoiceContact, InvoiceOrder, ReturnOrder, ReturnRow } from './types'

/** `plugins: [{ resolve: '@cloud-house/medusa-fakturownia', options }]` in `medusa-config.ts`. */
export interface FakturowniaOptions {
  /** The order as the invoice sees it; `null` when there is no such order. Required. */
  resolveOrder: (container: MedusaContainer, orderId: string) => Promise<InvoiceOrder | null>
  /** The order as the credit notes see it (quantities per line); `null` when there is none. Required. */
  resolveReturnOrder: (container: MedusaContainer, orderId: string) => Promise<ReturnOrder | null>
  /** One return with its lines; `null` when there is none. Required. */
  resolveReturn: (container: MedusaContainer, returnId: string) => Promise<ReturnRow | null>
  /** The shop's contact data shown in the e-mails (and `replyTo` of the invoice e-mail). */
  resolveContact?: (container: MedusaContainer) => Promise<InvoiceContact | null>
  /** Medusa payment provider id → Fakturownia payment type (`card`, `BLIK`, …); others → `transfer`. */
  paymentTypes?: Record<string, string>
  /** Prefix of the Fakturownia order number (`oid`); default `INV-`. `FAKTUROWNIA_OID_PREFIX` wins. */
  oidPrefix?: string
  /** Prefix of the log lines; default `[Fakturownia]`. */
  logPrefix?: string
  /** Path of an order in the customer account (`:id` = order id); default `/account/orders/:id`. */
  accountOrderPath?: string
}

export interface ResolvedFakturowniaOptions {
  resolveOrder: FakturowniaOptions['resolveOrder']
  resolveReturnOrder: FakturowniaOptions['resolveReturnOrder']
  resolveReturn: FakturowniaOptions['resolveReturn']
  resolveContact: NonNullable<FakturowniaOptions['resolveContact']> | null
  paymentTypes: Record<string, string>
  oidPrefix: string
  logPrefix: string
  accountOrderPath: string
}

/** `values` without the keys set to `undefined` (a spread would let them wipe a default). */
export const withoutUndefined = <T extends object>(values: T | undefined): Partial<T> =>
  Object.fromEntries(
    Object.entries(values ?? {}).filter(([, value]) => value !== undefined),
  ) as Partial<T>

const REQUIRED = ['resolveOrder', 'resolveReturnOrder', 'resolveReturn'] as const

/** Options with the defaults filled in (`undefined` values count as unset); throws when a required function is missing. */
export function resolveOptions(options: FakturowniaOptions): ResolvedFakturowniaOptions {
  const given = withoutUndefined(options)
  for (const key of REQUIRED) {
    if (typeof given[key] !== 'function') {
      throw new Error(
        `@cloud-house/medusa-fakturownia [${FAKTUROWNIA_ERROR_CODES.missingOption}]: option "${key}" is required (a function).`,
      )
    }
  }
  const {
    resolveContact = null,
    paymentTypes = {},
    oidPrefix = 'INV-',
    logPrefix = '[Fakturownia]',
    accountOrderPath = '/account/orders/:id',
  } = given
  return {
    resolveOrder: given.resolveOrder as FakturowniaOptions['resolveOrder'],
    resolveReturnOrder: given.resolveReturnOrder as FakturowniaOptions['resolveReturnOrder'],
    resolveReturn: given.resolveReturn as FakturowniaOptions['resolveReturn'],
    resolveContact,
    paymentTypes: { ...paymentTypes },
    oidPrefix,
    logPrefix,
    accountOrderPath,
  }
}

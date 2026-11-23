import type { MedusaContainer } from '@medusajs/framework/types'
import { MedusaError } from '@medusajs/framework/utils'
import { FAKTUROWNIA_MODULE } from '../modules/fakturownia'
import type FakturowniaModuleService from '../modules/fakturownia/service'
import type { CorrectionRow, InvoiceRow } from '../modules/fakturownia/service'
import type { FakturowniaConfig, KsefMode } from './config'
import { invoicingConfig, pluginOptions } from './plugin-options'
import { invoiceReady } from './state'

/** The invoice as the admin card shows it (spec 6c §5.7). */
export interface AdminInvoiceView {
  status: InvoiceRow['status']
  skipReason: InvoiceRow['skip_reason']
  number: string | null
  /** The invoice in the Fakturownia account; `null` for the fake. */
  fakturowniaUrl: string | null
  ksef: InvoiceRow['ksef']
  ksefNumber: string | null
  ksefError: string | null
  lastError: string | null
  errorKind: InvoiceRow['error_kind']
  differenceCents: number | null
  emailSentAt: string | null
  emailError: string | null
  ready: boolean
}

/** The credit note of one received return, shown read-only under the invoice (spec 6e-b, D12). */
export interface AdminCorrectionView {
  returnId: string
  status: CorrectionRow['status']
  attentionReason: CorrectionRow['attention_reason']
  number: string | null
  /** Gross total in grosze – negative; `null` until the note is made. */
  totalCents: number | null
  lastError: string | null
  /** The credit note in the Fakturownia account; `null` for the fake. */
  fakturowniaUrl: string | null
}

export interface AdminInvoiceResponse {
  configured: boolean
  /** How invoices go to KSeF; `null` without Fakturownia. */
  ksefMode: KsefMode | null
  order: { paid: boolean; canceled: boolean }
  invoice: AdminInvoiceView | null
  /** Credit notes of the order's returns, oldest first – shown even when the order has no invoice. */
  corrections: AdminCorrectionView[]
  actions: { issue: boolean; recheck: boolean; resendEmail: boolean; pdf: boolean }
}

const iso = (value: Date | string | null) => (value ? new Date(value).toISOString() : null)

/** A document of the Fakturownia account (invoices and credit notes share the address); `null` for the fake. */
const documentUrl = (config: FakturowniaConfig | null, id: string | null) =>
  config?.client === 'api' && config.url && id ? `${config.url}/invoices/${id}` : null

export function toAdminInvoiceResponse(
  row: InvoiceRow | null,
  config: FakturowniaConfig | null,
  order: { paid: boolean; canceled: boolean },
  corrections: CorrectionRow[] = [],
): AdminInvoiceResponse {
  const ready = row ? invoiceReady(row) : false
  const invoice: AdminInvoiceView | null = row && {
    status: row.status,
    skipReason: row.skip_reason,
    number: row.number,
    fakturowniaUrl: documentUrl(config, row.fakturownia_id),
    ksef: row.ksef,
    ksefNumber: row.ksef_number,
    ksefError: row.ksef_error,
    lastError: row.last_error,
    errorKind: row.error_kind,
    differenceCents: row.difference_cents,
    emailSentAt: iso(row.email_sent_at),
    emailError: row.email_error,
    ready,
  }
  const issuable =
    order.paid && !order.canceled && (!row || ['failed', 'skipped'].includes(row.status))
  return {
    configured: Boolean(config),
    ksefMode: config?.ksef ?? null,
    order,
    invoice,
    corrections: corrections.map((correction) => ({
      returnId: correction.return_id,
      status: correction.status,
      attentionReason: correction.attention_reason,
      number: correction.number,
      totalCents: correction.total_cents,
      lastError: correction.last_error,
      fakturowniaUrl: documentUrl(config, correction.fakturownia_id),
    })),
    actions: config
      ? { issue: issuable, recheck: row?.status === 'review', resendEmail: ready, pdf: ready }
      : { issue: false, recheck: false, resendEmail: false, pdf: false },
  }
}

/** The card of an order; 404 for an unknown order. */
export async function loadAdminInvoice(
  container: MedusaContainer,
  orderId: string,
): Promise<AdminInvoiceResponse> {
  const order = await pluginOptions(container).resolveOrder(container, orderId)
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Nie znaleziono zamówienia ${orderId}.`)
  }
  const fakturownia = container.resolve<FakturowniaModuleService>(FAKTUROWNIA_MODULE)
  const row = await fakturownia.findByOrder(orderId)
  const corrections = await fakturownia.correctionsOfOrder(orderId)
  return toAdminInvoiceResponse(
    row,
    invoicingConfig(container),
    { paid: order.paid, canceled: order.canceled },
    corrections,
  )
}

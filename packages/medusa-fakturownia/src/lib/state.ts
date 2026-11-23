import type { InvoiceRow } from '../modules/fakturownia/service'
import type { AccountInvoice } from '../types'
import type { KsefMode } from './config'
import type { BuyerKind } from './mapping'

export type KsefState = InvoiceRow['ksef']

/** Whether the shop sends this invoice to KSeF itself (spec 6c §5.4). */
export function ksefRequired(mode: KsefMode, kind: BuyerKind): boolean {
  return mode === 'all' || (mode === 'companies' && kind === 'company')
}

/**
 * Fakturownia's `gov_status` of an invoice sent to KSeF: `ok`/`offline` – the e-mail may go,
 * `processing` (or not reported yet) – wait, `not_applicable` – no KSeF for this document,
 * anything else (`send_error`, `not_connected`, …) – an error for the team.
 */
export function ksefFromGovStatus(status: string | null): Exclude<KsefState, 'pending'> {
  switch (status) {
    case 'ok':
    case 'offline':
      return status
    case 'processing':
    case null:
      return 'sent'
    case 'not_applicable':
      return 'none'
    default:
      return 'error'
  }
}

/** Issued and done with KSeF (or not in KSeF) – the customer may get the PDF. */
export function invoiceReady(row: Pick<InvoiceRow, 'status' | 'ksef'>): boolean {
  return row.status === 'issued' && ['none', 'ok', 'offline'].includes(row.ksef)
}

/** What the account shows (spec 6c §5.8): the PDF, „w przygotowaniu” or nothing. */
export function accountInvoice(
  row: Pick<InvoiceRow, 'status' | 'ksef'> | null,
): AccountInvoice | null {
  if (!row) return null
  if (invoiceReady(row)) return { state: 'ready' }
  return ['waiting', 'issuing', 'issued', 'review'].includes(row.status)
    ? { state: 'preparing' }
    : null
}

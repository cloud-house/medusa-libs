import type { AdminInvoiceResponse } from '../../lib/admin-view'
import { invoiceLabels, zl } from './invoice-labels'

export type InvoiceAction = 'issue' | 'recheck' | 'email'

export interface InvoiceToast {
  kind: 'success' | 'warning' | 'error'
  text: string
}

const DONE: Record<InvoiceAction, string> = {
  issue: 'Faktura wystawiona',
  recheck: 'Faktura sprawdzona',
  email: 'Mail z fakturą wysłany',
}

/** The toast after a card action – from the state the action left, not from the click. */
export function invoiceActionToast(
  action: InvoiceAction,
  response: AdminInvoiceResponse,
): InvoiceToast {
  const { invoice } = response
  const labels = invoiceLabels(response)
  if (!invoice || invoice.status === 'failed') return { kind: 'error', text: labels.status }
  if (invoice.status === 'review') {
    return {
      kind: 'warning',
      text:
        action === 'recheck'
          ? `Suma nadal się różni od zamówienia o ${zl(invoice.differenceCents ?? 0)}`
          : labels.status,
    }
  }
  if (invoice.status !== 'issued') return { kind: 'warning', text: labels.status }
  // Issued, but the next step did not go – the card says which.
  const problem =
    invoice.ksef === 'error'
      ? labels.ksef
      : !invoice.emailSentAt && invoice.emailError
        ? labels.email
        : null
  return problem
    ? { kind: 'warning', text: `${DONE[action]}. ${problem}` }
    : { kind: 'success', text: DONE[action] }
}

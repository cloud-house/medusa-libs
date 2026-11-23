import type {
  AdminCorrectionView,
  AdminInvoiceResponse,
  AdminInvoiceView,
} from '../../lib/admin-view'
import type { KsefMode } from '../../lib/config'

export interface InvoiceLabels {
  status: string
  ksef: string | null
  email: string | null
  warning: string | null
}

/** An amount in grosze as „1,50 zł” (no sign). */
export const zl = (cents: number) =>
  `${(Math.abs(cents) / 100).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`

const DATE = new Intl.DateTimeFormat('pl-PL', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Warsaw',
})

function status(invoice: AdminInvoiceView | null, paid: boolean): string {
  if (!invoice) return 'Brak faktury'
  switch (invoice.status) {
    case 'waiting':
      return paid ? 'Wystawiamy…' : 'Czeka na płatność'
    case 'issuing':
      return 'Wystawiamy…'
    case 'issued':
      return `Wystawiona: ${invoice.number}`
    case 'review':
      return `Do sprawdzenia: suma faktury różni się od zamówienia o ${zl(invoice.differenceCents ?? 0)}`
    case 'failed':
      return `Błąd: ${invoice.lastError ?? 'nieznany'}`
    case 'skipped':
      return invoice.skipReason === 'canceled'
        ? 'Pominięta – zamówienie anulowane'
        : 'Pominięta – brak płatności'
  }
}

function ksef(invoice: AdminInvoiceView): string | null {
  switch (invoice.ksef) {
    case 'pending':
      return 'Czeka na wysyłkę do KSeF'
    case 'sent':
      return 'Wysłana do KSeF – czeka na numer'
    case 'ok':
      return `KSeF: ${invoice.ksefNumber ?? 'nadany'}`
    case 'offline':
      return invoice.ksefNumber ? `KSeF: ${invoice.ksefNumber}` : 'KSeF: tryb offline'
    case 'error':
      return `Błąd KSeF: ${invoice.ksefError ?? 'nieznany'}`
    default:
      return null
  }
}

function email(invoice: AdminInvoiceView): string | null {
  if (invoice.status !== 'issued') return null
  if (invoice.emailSentAt) return `Wysłana e-mailem ${DATE.format(new Date(invoice.emailSentAt))}`
  if (invoice.emailError) return `Mail nie wyszedł: ${invoice.emailError}`
  if (!invoice.ready) return 'Mail czeka na numer KSeF'
  return 'Mail jeszcze nie wyszedł'
}

/** Polish texts of the „Faktura” card (spec 6c §5.7). */
export function invoiceLabels(response: AdminInvoiceResponse): InvoiceLabels {
  if (!response.configured) {
    return { status: 'Fakturownia nie jest skonfigurowana', ksef: null, email: null, warning: null }
  }
  const { invoice, order } = response
  const issued = invoice && ['issued', 'review'].includes(invoice.status)
  return {
    status: status(invoice, order.paid),
    ksef: invoice && issued ? ksef(invoice) : null,
    email: invoice ? email(invoice) : null,
    warning: order.canceled && issued ? 'Zamówienie anulowane – wystaw korektę w Fakturowni' : null,
  }
}

const ATTENTION: Record<NonNullable<AdminCorrectionView['attentionReason']>, string> = {
  no_invoice: 'Brak faktury pierwotnej – wystaw korektę ręcznie w Fakturowni',
  invoice_not_ready: 'Korekta czeka na wystawienie faktury pierwotnej',
  partial_receipt: 'Zwrot przyjęty częściowo – korekta po przyjęciu wszystkich pozycji',
}

/** One line of the „Korekty” list: the credit note of a returned order (spec 6e-b, D12). */
export function correctionLabel(correction: AdminCorrectionView): string {
  switch (correction.status) {
    case 'issued':
      return `Korekta ${correction.number} (−${zl(correction.totalCents ?? 0)})`
    case 'waiting':
    case 'issuing':
      return 'Wystawiamy korektę…'
    case 'attention':
      return ATTENTION[correction.attentionReason ?? 'no_invoice']
    case 'failed':
      return `Błąd korekty: ${correction.lastError ?? 'nieznany'}`
  }
}

/** Credit notes never go to KSeF from the shop – a reminder when invoices do (spec 6e-b, D3). */
export function correctionKsefHint(config: { ksef: KsefMode } | null): string | null {
  return config && config.ksef !== 'off'
    ? 'Korekty wyślij do KSeF w Fakturowni – sklep tego nie robi.'
    : null
}

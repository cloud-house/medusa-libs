import type {
  AdminCorrectionView,
  AdminInvoiceResponse,
  AdminInvoiceView,
} from '../../../lib/admin-view'
import { correctionKsefHint, correctionLabel, invoiceLabels } from '../invoice-labels'

const view = (over: Partial<AdminInvoiceView> = {}): AdminInvoiceView => ({
  status: 'issued',
  skipReason: null,
  number: 'FV 12/11/2026',
  fakturowniaUrl: null,
  ksef: 'none',
  ksefNumber: null,
  ksefError: null,
  lastError: null,
  errorKind: null,
  differenceCents: null,
  emailSentAt: null,
  emailError: null,
  ready: true,
  ...over,
})

const correction = (over: Partial<AdminCorrectionView> = {}): AdminCorrectionView => ({
  returnId: 'ret_1',
  status: 'issued',
  attentionReason: null,
  number: 'KOR 1/11/2026',
  totalCents: -31599,
  lastError: null,
  fakturowniaUrl: null,
  ...over,
})

const response = (
  invoice: AdminInvoiceView | null,
  over: Partial<AdminInvoiceResponse> = {},
): AdminInvoiceResponse => ({
  configured: true,
  order: { paid: true, canceled: false },
  invoice,
  corrections: [],
  ksefMode: 'off',
  actions: { issue: false, recheck: false, resendEmail: false, pdf: false },
  ...over,
})

describe('invoiceLabels', () => {
  it('says when Fakturownia is not set up', () => {
    expect(invoiceLabels(response(null, { configured: false }))).toEqual({
      status: 'Fakturownia nie jest skonfigurowana',
      ksef: null,
      email: null,
      warning: null,
    })
  })

  it('names every invoice state', () => {
    const status = (invoice: AdminInvoiceView | null, paid = true) =>
      invoiceLabels(response(invoice, { order: { paid, canceled: false } })).status
    expect(status(null)).toBe('Brak faktury')
    expect(status(view({ status: 'waiting' }), false)).toBe('Czeka na płatność')
    expect(status(view({ status: 'waiting' }))).toBe('Wystawiamy…')
    expect(status(view({ status: 'issuing' }))).toBe('Wystawiamy…')
    expect(status(view())).toBe('Wystawiona: FV 12/11/2026')
    expect(status(view({ status: 'failed', lastError: 'HTTP 503' }))).toBe('Błąd: HTTP 503')
    expect(status(view({ status: 'skipped', skipReason: 'canceled' }))).toBe(
      'Pominięta – zamówienie anulowane',
    )
    expect(status(view({ status: 'skipped', skipReason: 'unpaid' }))).toBe(
      'Pominięta – brak płatności',
    )
    expect(status(view({ status: 'review', differenceCents: -1 }))).toBe(
      'Do sprawdzenia: suma faktury różni się od zamówienia o 0,01 zł',
    )
  })

  it('names the KSeF state', () => {
    const ksef = (over: Partial<AdminInvoiceView>) => invoiceLabels(response(view(over))).ksef
    expect(ksef({})).toBeNull()
    expect(ksef({ ksef: 'pending' })).toBe('Czeka na wysyłkę do KSeF')
    expect(ksef({ ksef: 'sent' })).toBe('Wysłana do KSeF – czeka na numer')
    expect(ksef({ ksef: 'ok', ksefNumber: '5260250274-20261102-1A2B' })).toBe(
      'KSeF: 5260250274-20261102-1A2B',
    )
    expect(ksef({ ksef: 'offline' })).toBe('KSeF: tryb offline')
    expect(ksef({ ksef: 'error', ksefError: 'Błędny NIP' })).toBe('Błąd KSeF: Błędny NIP')
  })

  it('names the e-mail state', () => {
    const email = (over: Partial<AdminInvoiceView>) => invoiceLabels(response(view(over))).email
    expect(email({ emailSentAt: '2026-11-02T10:00:00.000Z' })).toMatch(
      /^Wysłana e-mailem 2 lis 2026/,
    )
    expect(email({ ksef: 'sent', ready: false })).toBe('Mail czeka na numer KSeF')
    expect(email({ emailError: 'Resend: Invalid from' })).toBe(
      'Mail nie wyszedł: Resend: Invalid from',
    )
    expect(email({ status: 'failed' })).toBeNull()
  })

  it('warns about a canceled order with an invoice', () => {
    expect(invoiceLabels(response(view(), { order: { paid: true, canceled: true } })).warning).toBe(
      'Zamówienie anulowane – wystaw korektę w Fakturowni',
    )
    expect(invoiceLabels(response(view())).warning).toBeNull()
  })
})

describe('correctionLabel', () => {
  it('an issued credit note: the number and the amount returned', () => {
    expect(correctionLabel(correction())).toBe('Korekta KOR 1/11/2026 (−315,99 zł)')
    expect(correctionLabel(correction({ number: 'KOR 2/11/2026', totalCents: -1500 }))).toBe(
      'Korekta KOR 2/11/2026 (−15,00 zł)',
    )
  })

  it('a note still being made', () => {
    expect(correctionLabel(correction({ status: 'waiting', number: null, totalCents: null }))).toBe(
      'Wystawiamy korektę…',
    )
    expect(correctionLabel(correction({ status: 'issuing', number: null, totalCents: null }))).toBe(
      'Wystawiamy korektę…',
    )
  })

  it('names every reason a note waits for a person', () => {
    const attention = (attentionReason: AdminCorrectionView['attentionReason']) =>
      correctionLabel(correction({ status: 'attention', attentionReason, number: null }))
    expect(attention('no_invoice')).toBe(
      'Brak faktury pierwotnej – wystaw korektę ręcznie w Fakturowni',
    )
    expect(attention('invoice_not_ready')).toBe('Korekta czeka na wystawienie faktury pierwotnej')
    expect(attention('partial_receipt')).toBe(
      'Zwrot przyjęty częściowo – korekta po przyjęciu wszystkich pozycji',
    )
  })

  it('a failed note: the error, or „nieznany”', () => {
    const failed = (lastError: string | null) =>
      correctionLabel(correction({ status: 'failed', number: null, lastError }))
    expect(failed('HTTP 503')).toBe('Błąd korekty: HTTP 503')
    expect(failed(null)).toBe('Błąd korekty: nieznany')
  })
})

describe('correctionKsefHint', () => {
  const hint = 'Korekty wyślij do KSeF w Fakturowni – sklep tego nie robi.'

  it('reminds of KSeF when the shop sends invoices there', () => {
    expect(correctionKsefHint({ ksef: 'companies' })).toBe(hint)
    expect(correctionKsefHint({ ksef: 'all' })).toBe(hint)
  })

  it('stays quiet without KSeF or without Fakturownia', () => {
    expect(correctionKsefHint({ ksef: 'off' })).toBeNull()
    expect(correctionKsefHint(null)).toBeNull()
  })
})

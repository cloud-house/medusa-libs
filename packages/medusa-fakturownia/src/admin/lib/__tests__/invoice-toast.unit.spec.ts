import type { AdminInvoiceResponse, AdminInvoiceView } from '../../../lib/admin-view'
import { invoiceActionToast } from '../invoice-toast'

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
  emailSentAt: '2026-11-02T10:00:00.000Z',
  emailError: null,
  ready: true,
  ...over,
})

const response = (invoice: AdminInvoiceView | null): AdminInvoiceResponse => ({
  configured: true,
  order: { paid: true, canceled: false },
  invoice,
  corrections: [],
  ksefMode: 'off',
  actions: { issue: false, recheck: false, resendEmail: false, pdf: false },
})

describe('invoiceActionToast', () => {
  it('confirms what went through', () => {
    expect(invoiceActionToast('issue', response(view()))).toEqual({
      kind: 'success',
      text: 'Faktura wystawiona',
    })
    expect(invoiceActionToast('recheck', response(view()))).toEqual({
      kind: 'success',
      text: 'Faktura sprawdzona',
    })
    expect(invoiceActionToast('email', response(view()))).toEqual({
      kind: 'success',
      text: 'Mail z fakturą wysłany',
    })
  })

  it('an issue that failed again is an error with the card status', () => {
    const failed = view({ status: 'failed', lastError: 'HTTP 503', number: null })
    expect(invoiceActionToast('issue', response(failed))).toEqual({
      kind: 'error',
      text: 'Błąd: HTTP 503',
    })
  })

  it('a recheck with the total still off is a warning', () => {
    const held = view({ status: 'review', differenceCents: -150, ready: false })
    expect(invoiceActionToast('recheck', response(held))).toEqual({
      kind: 'warning',
      text: 'Suma nadal się różni od zamówienia o 1,50 zł',
    })
    expect(invoiceActionToast('issue', response(held))).toEqual({
      kind: 'warning',
      text: 'Do sprawdzenia: suma faktury różni się od zamówienia o 1,50 zł',
    })
  })

  it('an issued invoice whose KSeF send or e-mail failed is a warning naming it', () => {
    expect(
      invoiceActionToast(
        'issue',
        response(view({ ksef: 'error', ksefError: 'Błędny NIP', ready: false, emailSentAt: null })),
      ),
    ).toEqual({ kind: 'warning', text: 'Faktura wystawiona. Błąd KSeF: Błędny NIP' })
    expect(
      invoiceActionToast(
        'recheck',
        response(view({ emailSentAt: null, emailError: 'Resend: Invalid from' })),
      ),
    ).toEqual({
      kind: 'warning',
      text: 'Faktura sprawdzona. Mail nie wyszedł: Resend: Invalid from',
    })
  })
})

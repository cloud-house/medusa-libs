import type { InvoiceRow } from '../../modules/fakturownia/service'
import { accountInvoice, invoiceReady, ksefFromGovStatus, ksefRequired } from '../state'

const row = (over: Partial<InvoiceRow>) =>
  ({ status: 'issued', ksef: 'none', ...over }) as InvoiceRow

describe('ksefRequired', () => {
  it('follows FAKTUROWNIA_KSEF and the buyer', () => {
    expect(ksefRequired('off', 'company')).toBe(false)
    expect(ksefRequired('companies', 'person')).toBe(false)
    expect(ksefRequired('companies', 'company')).toBe(true)
    expect(ksefRequired('all', 'person')).toBe(true)
    expect(ksefRequired('all', 'company')).toBe(true)
  })
})

describe('ksefFromGovStatus', () => {
  it.each([
    ['ok', 'ok'],
    ['offline', 'offline'],
    ['processing', 'sent'],
    [null, 'sent'],
    ['not_applicable', 'none'],
    ['send_error', 'error'],
    ['server_error', 'error'],
    ['duplicate_error', 'error'],
    ['not_connected', 'error'],
    ['something_new', 'error'],
  ])('%s → %s', (status, state) => {
    expect(ksefFromGovStatus(status)).toBe(state)
  })
})

describe('invoiceReady', () => {
  it('is ready only when issued and KSeF is done or not needed', () => {
    expect(invoiceReady(row({ ksef: 'none' }))).toBe(true)
    expect(invoiceReady(row({ ksef: 'ok' }))).toBe(true)
    expect(invoiceReady(row({ ksef: 'offline' }))).toBe(true)
    expect(invoiceReady(row({ ksef: 'pending' }))).toBe(false)
    expect(invoiceReady(row({ ksef: 'sent' }))).toBe(false)
    expect(invoiceReady(row({ ksef: 'error' }))).toBe(false)
    for (const status of ['waiting', 'issuing', 'review', 'failed', 'skipped'] as const) {
      expect(invoiceReady(row({ status }))).toBe(false)
    }
  })
})

describe('accountInvoice', () => {
  it('tells the account whether to offer the PDF', () => {
    expect(accountInvoice(row({}))).toEqual({ state: 'ready' })
    expect(accountInvoice(row({ ksef: 'sent' }))).toEqual({ state: 'preparing' })
    for (const status of ['waiting', 'issuing', 'review'] as const) {
      expect(accountInvoice(row({ status }))).toEqual({ state: 'preparing' })
    }
    expect(accountInvoice(row({ status: 'failed' }))).toBeNull()
    expect(accountInvoice(row({ status: 'skipped' }))).toBeNull()
    expect(accountInvoice(null)).toBeNull()
  })
})

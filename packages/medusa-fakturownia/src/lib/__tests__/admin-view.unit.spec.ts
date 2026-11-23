import type { CorrectionRow } from '../../modules/fakturownia/service'
import { toAdminInvoiceResponse } from '../admin-view'
import type { FakturowniaConfig } from '../config'

const API: FakturowniaConfig = {
  client: 'api',
  url: 'https://shop.fakturownia.pl',
  token: 'secret',
  departmentId: null,
  ksef: 'companies',
  oidPrefix: 'CHNS-',
}
const FAKE: FakturowniaConfig = { ...API, client: 'fake', url: null, token: null, ksef: 'off' }
const ORDER = { paid: true, canceled: false }

const note = (over: Partial<CorrectionRow> = {}): CorrectionRow =>
  ({
    id: 'invcor_1',
    return_id: 'ret_1',
    order_id: 'order_1',
    status: 'issued',
    attention_reason: null,
    items: [{ item_id: 'item_1', quantity: 1 }],
    includes_shipping: true,
    fakturownia_id: '9001',
    number: 'KOR 1/11/2026',
    total_cents: -31599,
    attempts: 1,
    problem_since: null,
    next_attempt_at: null,
    last_error: null,
    error_kind: null,
    alerted_for: null,
    ...over,
  }) as CorrectionRow

describe('credit notes on the admin card', () => {
  it('lists none for an order without returns', () => {
    expect(toAdminInvoiceResponse(null, API, ORDER).corrections).toEqual([])
    expect(toAdminInvoiceResponse(null, API, ORDER, []).corrections).toEqual([])
  })

  it('shows an issued note with its number, total and Fakturownia address', () => {
    expect(toAdminInvoiceResponse(null, API, ORDER, [note()]).corrections).toEqual([
      {
        returnId: 'ret_1',
        status: 'issued',
        attentionReason: null,
        number: 'KOR 1/11/2026',
        totalCents: -31599,
        lastError: null,
        fakturowniaUrl: 'https://shop.fakturownia.pl/invoices/9001',
      },
    ])
  })

  it('has no address for the fake, for a note not made yet or without Fakturownia', () => {
    const open = (config: FakturowniaConfig | null, row: CorrectionRow) =>
      toAdminInvoiceResponse(null, config, ORDER, [row]).corrections[0]?.fakturowniaUrl
    expect(open(FAKE, note())).toBeNull()
    expect(open(API, note({ fakturownia_id: null }))).toBeNull()
    expect(open(null, note())).toBeNull()
  })

  it('keeps the notes in the order given, the one waiting for a person included', () => {
    const response = toAdminInvoiceResponse(null, API, ORDER, [
      note(),
      note({
        return_id: 'ret_2',
        status: 'attention',
        attention_reason: 'partial_receipt',
        fakturownia_id: null,
        number: null,
        total_cents: null,
      }),
    ])
    expect(response.corrections.map((view) => [view.returnId, view.status])).toEqual([
      ['ret_1', 'issued'],
      ['ret_2', 'attention'],
    ])
    expect(response.corrections[1]).toMatchObject({
      attentionReason: 'partial_receipt',
      number: null,
      totalCents: null,
    })
  })

  it('tells the panel how the shop sends invoices to KSeF', () => {
    expect(toAdminInvoiceResponse(null, API, ORDER).ksefMode).toBe('companies')
    expect(toAdminInvoiceResponse(null, FAKE, ORDER).ksefMode).toBe('off')
    expect(toAdminInvoiceResponse(null, null, ORDER).ksefMode).toBeNull()
  })

  it('leaves the card actions as they were', () => {
    expect(toAdminInvoiceResponse(null, API, ORDER, [note()]).actions).toEqual({
      issue: true,
      recheck: false,
      resendEmail: false,
      pdf: false,
    })
  })
})

import { type CorrectionPayload, FakturowniaError, type InvoicePayload } from '../client'
import { createFakeClient, fakeFakturownia } from '../fake'
import { samplePdf } from '../pdf'

const payload = (oid: string, email = 'jan@example.pl'): InvoicePayload => ({
  oid,
  oid_unique: 'yes',
  buyer_email: email,
  positions: [
    { name: 'Deska', price_gross: '499.99', quantity: 2, discount: '50.00' },
    { name: 'Dostawa – Kurier DPD', price_gross: '19.99', quantity: 1 },
  ],
})

async function failure(promise: Promise<unknown>): Promise<FakturowniaError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof FakturowniaError) return error
    throw error
  }
  throw new Error('expected a FakturowniaError')
}

describe('in-process Fakturownia fake', () => {
  beforeEach(() => fakeFakturownia().reset())

  it('keeps one state for the whole process', () => {
    fakeFakturownia().totalDeltaCents = 5
    expect(fakeFakturownia().totalDeltaCents).toBe(5)
  })

  it('numbers invoices and sums positions after discounts', async () => {
    const client = createFakeClient()

    const first = await client.createInvoice(payload('INV-1001'))
    const second = await client.createInvoice(payload('INV-1002'))

    expect(first.number).toMatch(/^FV 1\/\d{2}\/\d{4}$/)
    expect(second.number).toMatch(/^FV 2\//)
    expect(first.totalCents).toBe(2 * 49999 - 5000 + 1999)
    expect(first).toMatchObject({ oid: 'INV-1001', buyerEmail: 'jan@example.pl', govStatus: null })
    expect(await client.getInvoice(first.id)).toMatchObject({ number: first.number })
  })

  it('refuses a second invoice with the same unique oid', async () => {
    const client = createFakeClient()
    await client.createInvoice(payload('INV-1001'))

    const error = await failure(client.createInvoice(payload('INV-1001')))

    expect(error.kind).toBe('duplicate')
    expect(fakeFakturownia().invoices).toHaveLength(1)
  })

  it('fails the next call on request', async () => {
    const client = createFakeClient()
    fakeFakturownia().failNext('transient')
    fakeFakturownia().failNext('permanent')

    expect((await failure(client.createInvoice(payload('INV-1')))).kind).toBe('transient')
    expect((await failure(client.createInvoice(payload('INV-1')))).kind).toBe('permanent')
    expect(fakeFakturownia().invoices).toHaveLength(0)
    expect((await client.createInvoice(payload('INV-1'))).oid).toBe('INV-1')
  })

  it('saves the invoice and still fails a „lost” answer', async () => {
    const client = createFakeClient()
    fakeFakturownia().failNext('lost')

    expect((await failure(client.createInvoice(payload('INV-1001')))).kind).toBe('transient')
    expect((await client.findInvoiceByOid('INV-1001'))?.oid).toBe('INV-1001')
  })

  it('applies the total difference on every read', async () => {
    const client = createFakeClient()
    fakeFakturownia().totalDeltaCents = 1
    const invoice = await client.createInvoice(payload('INV-1001'))
    expect(invoice.totalCents).toBe(96998)

    fakeFakturownia().totalDeltaCents = 0
    expect((await client.getInvoice(invoice.id)).totalCents).toBe(96997)
  })

  it('walks KSeF from processing to ok', async () => {
    const client = createFakeClient()
    const invoice = await client.createInvoice(payload('INV-1001'))

    expect((await client.sendToKsef(invoice.id)).govStatus).toBe('processing')
    expect((await client.getInvoice(invoice.id)).govStatus).toBe('processing')
    fakeFakturownia().ksef = 'ok'
    const done = await client.getInvoice(invoice.id)
    expect(done.govStatus).toBe('ok')
    expect(done.govId).toBeTruthy()
  })

  it('reports a KSeF error', async () => {
    const client = createFakeClient()
    fakeFakturownia().ksef = 'error'
    const invoice = await client.createInvoice(payload('INV-1001'))

    const sent = await client.sendToKsef(invoice.id)

    expect(sent.govStatus).toBe('send_error')
    expect(sent.govErrors).toBeTruthy()
  })

  it('serves a PDF with the invoice number', async () => {
    const client = createFakeClient()
    const invoice = await client.createInvoice(payload('INV-1001'))

    const pdf = await client.downloadPdf(invoice.id)

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(pdf.toString('latin1')).toContain(invoice.number)
  })

  it('fails the next PDF download like an outage, then serves it again', async () => {
    const client = createFakeClient()
    const invoice = await client.createInvoice(payload('INV-1001'))
    fakeFakturownia().failNextPdf()

    const error = await failure(client.downloadPdf(invoice.id))

    expect(error).toMatchObject({ kind: 'transient', status: 503 })
    expect((await client.downloadPdf(invoice.id)).subarray(0, 5).toString()).toBe('%PDF-')
  })
})

describe('in-process Fakturownia fake – corrections', () => {
  beforeEach(() => fakeFakturownia().reset())

  const side = (
    kind: 'correction_before' | 'correction_after',
    quantity: string,
    gross: string,
  ) => ({
    name: 'Deska',
    quantity,
    total_price_gross: gross,
    tax: '23',
    kind,
  })

  const correction = (invoiceId: string, oid = 'INV-1001-Z1'): CorrectionPayload => ({
    kind: 'correction',
    invoice_id: invoiceId,
    from_invoice_id: invoiceId,
    correction_reason: 'Zwrot towaru – odstąpienie od umowy',
    oid,
    oid_unique: 'yes',
    buyer_email: 'jan@example.pl',
    positions: [
      {
        name: 'Deska',
        quantity: -1,
        total_price_gross: '-474.99',
        tax: '23',
        kind: 'correction',
        correction_before_attributes: side('correction_before', '2', '949.98'),
        correction_after_attributes: side('correction_after', '1', '474.99'),
      },
      {
        name: 'Dostawa – Kurier DPD',
        quantity: -1,
        total_price_gross: '-19.99',
        tax: '23',
        kind: 'correction',
        correction_before_attributes: side('correction_before', '1', '19.99'),
        correction_after_attributes: side('correction_after', '0', '0.00'),
      },
    ],
  })

  it('numbers corrections on their own and sums the position differences', async () => {
    const client = createFakeClient()
    const invoice = await client.createInvoice(payload('INV-1001'))

    const first = await client.createCorrection(correction(invoice.id))
    const second = await client.createCorrection(correction(invoice.id, 'INV-1001-Z2'))

    expect(first.number).toMatch(/^KOR 1\/\d{2}\/\d{4}$/)
    expect(second.number).toMatch(/^KOR 2\//)
    expect(first.id).toBe('5001')
    expect(first).toMatchObject({ oid: 'INV-1001-Z1', totalCents: -49498, govStatus: null })
    expect(fakeFakturownia().corrections.map((row) => row.payload.oid)).toEqual([
      'INV-1001-Z1',
      'INV-1001-Z2',
    ])
    expect(fakeFakturownia().invoices).toHaveLength(1)
  })

  it('refuses a correction of an invoice it does not have', async () => {
    const error = await failure(createFakeClient().createCorrection(correction('999')))

    expect(error.kind).toBe('permanent')
    expect(error.message).toBe('Atrapa: nie ma faktury 999.')
    expect(fakeFakturownia().corrections).toHaveLength(0)
  })

  it('refuses a second correction with the same oid, also an oid an invoice took', async () => {
    const client = createFakeClient()
    const invoice = await client.createInvoice(payload('INV-1001'))
    await client.createCorrection(correction(invoice.id))

    expect((await failure(client.createCorrection(correction(invoice.id)))).kind).toBe('duplicate')
    expect((await failure(client.createCorrection(correction(invoice.id, 'INV-1001')))).kind).toBe(
      'duplicate',
    )
    expect(fakeFakturownia().corrections).toHaveLength(1)
  })

  it('fails the next correction on request; a lost answer still saves it', async () => {
    const client = createFakeClient()
    const invoice = await client.createInvoice(payload('INV-1001'))
    fakeFakturownia().failNextCorrection('transient')
    fakeFakturownia().failNextCorrection('permanent')
    fakeFakturownia().failNextCorrection('lost')

    expect((await failure(client.createCorrection(correction(invoice.id)))).kind).toBe('transient')
    expect((await failure(client.createCorrection(correction(invoice.id)))).kind).toBe('permanent')
    expect(fakeFakturownia().corrections).toHaveLength(0)
    expect((await failure(client.createCorrection(correction(invoice.id)))).kind).toBe('transient')
    expect(fakeFakturownia().corrections).toHaveLength(1)
    // Corrections fail on their own queue – the invoices' one is untouched.
    expect(fakeFakturownia().failures).toEqual([])
  })

  it('finds a correction by its oid and forgets corrections on reset', async () => {
    const client = createFakeClient()
    const invoice = await client.createInvoice(payload('INV-1001'))
    const created = await client.createCorrection(correction(invoice.id))

    expect(await client.findInvoiceByOid('INV-1001-Z1')).toMatchObject({
      id: created.id,
      number: created.number,
      totalCents: -49498,
    })
    expect((await client.findInvoiceByOid('INV-1001'))?.id).toBe(invoice.id)

    fakeFakturownia().failNextCorrection('transient')
    fakeFakturownia().reset()
    expect(fakeFakturownia().corrections).toEqual([])
    expect(fakeFakturownia().correctionFailures).toEqual([])
  })
})

describe('samplePdf', () => {
  it('builds a PDF document with the text and an xref table', () => {
    const pdf = samplePdf('FV 1 (test)').toString('latin1')
    expect(pdf.startsWith('%PDF-1.4')).toBe(true)
    expect(pdf).toContain('(FV 1 \\(test\\)) Tj')
    expect(pdf).toContain('xref')
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true)
  })
})

import {
  type CorrectionPayload,
  createFakturowniaClient,
  FakturowniaError,
  type InvoicePayload,
} from '../client'

type Recorded = { url: string; method: string; body: unknown }

function fakeFetch(responses: { status?: number; body: unknown; raw?: boolean }[]) {
  const calls: Recorded[] = []
  const fetch = async (input: string, init?: RequestInit) => {
    calls.push({
      url: input,
      method: init?.method ?? 'GET',
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    })
    const next = responses.shift() ?? { body: {} }
    const body = next.raw ? (next.body as BodyInit) : JSON.stringify(next.body)
    return new Response(body, { status: next.status ?? 200 })
  }
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls }
}

const URL_BASE = 'https://shop.fakturownia.pl'
const TOKEN = 'secret-token-123'

const payload: InvoicePayload = {
  oid: 'INV-1001',
  buyer_email: 'jan@example.pl',
  positions: [{ name: 'Smycz', price_gross: '123.45', quantity: 1 }],
}

const INVOICE = {
  id: 501,
  number: 'FV 1/11/2026',
  price_gross: '123.45',
  buyer_email: 'jan@example.pl',
  oid: 'INV-1001',
  gov_status: null,
}

function client(fetch: typeof globalThis.fetch, timeoutMs?: number) {
  return createFakturowniaClient({ url: URL_BASE, token: TOKEN, fetch, timeoutMs })
}

async function failure(promise: Promise<unknown>): Promise<FakturowniaError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof FakturowniaError) return error
    throw error
  }
  throw new Error('expected a FakturowniaError')
}

describe('createFakturowniaClient', () => {
  it('creates an invoice with the token and reads the total in grosze', async () => {
    const { fetch, calls } = fakeFetch([{ body: INVOICE }])

    const invoice = await client(fetch).createInvoice(payload)

    expect(calls[0]).toEqual({
      url: `${URL_BASE}/invoices.json`,
      method: 'POST',
      body: { api_token: TOKEN, invoice: payload },
    })
    expect(invoice).toEqual({
      id: '501',
      number: 'FV 1/11/2026',
      totalCents: 12345,
      buyerEmail: 'jan@example.pl',
      oid: 'INV-1001',
      govStatus: null,
      govId: null,
      govErrors: null,
    })
  })

  it('reads KSeF fields and joins KSeF errors', async () => {
    const { fetch, calls } = fakeFetch([
      {
        body: {
          ...INVOICE,
          gov_status: 'send_error',
          gov_id: null,
          gov_error_messages: ['Błędny NIP', 'Brak adresu'],
        },
      },
    ])

    const invoice = await client(fetch).sendToKsef('501')

    const url = new URL(calls[0]?.url ?? '')
    expect(url.pathname).toBe('/invoices/501.json')
    expect(url.searchParams.get('api_token')).toBe(TOKEN)
    expect(url.searchParams.get('send_to_ksef')).toBe('yes')
    expect(invoice.govStatus).toBe('send_error')
    expect(invoice.govErrors).toBe('Błędny NIP; Brak adresu')
  })

  it('gets one invoice by id', async () => {
    const { fetch, calls } = fakeFetch([{ body: { ...INVOICE, gov_status: 'ok', gov_id: 'K-1' } }])

    const invoice = await client(fetch).getInvoice('501')

    expect(new URL(calls[0]?.url ?? '').pathname).toBe('/invoices/501.json')
    expect(invoice).toMatchObject({ govStatus: 'ok', govId: 'K-1' })
  })

  it('finds an invoice by the exact oid', async () => {
    const { fetch, calls } = fakeFetch([
      {
        body: [
          { ...INVOICE, id: 1, oid: 'INV-10010' },
          { ...INVOICE, id: 2, oid: 'INV-1001' },
        ],
      },
    ])

    const invoice = await client(fetch).findInvoiceByOid('INV-1001')

    const url = new URL(calls[0]?.url ?? '')
    expect(url.pathname).toBe('/invoices.json')
    expect(url.searchParams.get('query')).toBe('INV-1001')
    expect(url.searchParams.get('period')).toBe('all')
    expect(invoice?.id).toBe('2')
  })

  it('finds nothing when no invoice has the oid', async () => {
    const { fetch } = fakeFetch([{ body: [{ ...INVOICE, oid: 'INV-10010' }] }, { body: [] }])

    expect(await client(fetch).findInvoiceByOid('INV-1001')).toBeNull()
    expect(await client(fetch).findInvoiceByOid('INV-1001')).toBeNull()
  })

  it('downloads the PDF as a buffer', async () => {
    const { fetch, calls } = fakeFetch([{ body: '%PDF-1.4 test', raw: true }])

    const pdf = await client(fetch).downloadPdf('501')

    expect(new URL(calls[0]?.url ?? '').pathname).toBe('/invoices/501.pdf')
    expect(Buffer.isBuffer(pdf)).toBe(true)
    expect(pdf.toString()).toBe('%PDF-1.4 test')
  })

  it('treats server errors, throttling and a lost connection as transient', async () => {
    for (const status of [503, 500, 429, 408]) {
      const { fetch } = fakeFetch([{ status, body: { message: 'x' } }])
      const error = await failure(client(fetch).createInvoice(payload))
      expect([error.kind, error.status]).toEqual(['transient', status])
    }
    const offline = (async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof globalThis.fetch
    expect((await failure(client(offline).createInvoice(payload))).kind).toBe('transient')
  })

  it('gives up waiting after the timeout as a transient error', async () => {
    const hanging = ((_input: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
      })) as unknown as typeof globalThis.fetch

    const error = await failure(client(hanging, 20).createInvoice(payload))

    expect(error.kind).toBe('transient')
    expect(error.message).toContain('nie odpowiedziała')
  })

  it('recognises a duplicate oid', async () => {
    const { fetch } = fakeFetch([
      { status: 422, body: { code: 'error', message: { oid: ['jest już zajęte'] } } },
    ])

    const error = await failure(client(fetch).createInvoice(payload))

    expect(error.kind).toBe('duplicate')
    expect(error.message).toContain('oid: jest już zajęte')
  })

  it('reports other validation errors as permanent with the Fakturownia message', async () => {
    const { fetch } = fakeFetch([
      { status: 422, body: { code: 'error', message: { buyer_tax_no: ['jest nieprawidłowy'] } } },
    ])

    const error = await failure(client(fetch).createInvoice(payload))

    expect([error.kind, error.status]).toEqual(['permanent', 422])
    expect(error.message).toContain('buyer_tax_no: jest nieprawidłowy')
  })

  it('reports an error answered with HTTP 200 as permanent', async () => {
    const { fetch } = fakeFetch([{ body: { code: 'error', message: 'Konto zablokowane' } }])

    const error = await failure(client(fetch).createInvoice(payload))

    expect(error.kind).toBe('permanent')
    expect(error.message).toContain('Konto zablokowane')
  })

  it('creates a correction like an invoice, through POST /invoices.json', async () => {
    const correction: CorrectionPayload = {
      kind: 'correction',
      invoice_id: '501',
      from_invoice_id: '501',
      correction_reason: 'Zwrot towaru – odstąpienie od umowy',
      oid: 'INV-1001-Z1',
      oid_unique: 'yes',
      buyer_email: 'jan@example.pl',
      positions: [],
    }
    const { fetch, calls } = fakeFetch([
      { body: { ...INVOICE, id: 502, number: 'KOR 1/11/2026', price_gross: '-123.45' } },
    ])

    const created = await client(fetch).createCorrection(correction)

    expect(calls[0]).toEqual({
      url: `${URL_BASE}/invoices.json`,
      method: 'POST',
      body: { api_token: TOKEN, invoice: correction },
    })
    expect(created).toMatchObject({ id: '502', number: 'KOR 1/11/2026', totalCents: -12345 })
  })

  it('recognises a taken correction oid as a duplicate', async () => {
    const { fetch } = fakeFetch([
      { status: 422, body: { code: 'error', message: { oid: ['jest już zajęte'] } } },
    ])

    const error = await failure(
      client(fetch).createCorrection({
        kind: 'correction',
        invoice_id: '501',
        from_invoice_id: '501',
        correction_reason: 'x',
        oid: 'INV-1001-Z1',
        oid_unique: 'yes',
        buyer_email: null,
        positions: [],
      }),
    )

    expect(error.kind).toBe('duplicate')
  })

  it('never puts the token into an error message', async () => {
    const { fetch } = fakeFetch([
      { status: 401, body: { code: 'error', message: `Zły token ${TOKEN}` } },
    ])

    const error = await failure(client(fetch).getInvoice('501'))

    expect(error.kind).toBe('permanent')
    expect(error.message).not.toContain(TOKEN)
  })
})

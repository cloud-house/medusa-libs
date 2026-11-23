/** One invoice position as Fakturownia takes it (gross prices in zł with a dot). */
export interface InvoicePosition {
  name: string
  price_gross: string
  quantity: number
  /** Gross amount discount of the whole position (`discount_kind: 'amount'`). */
  discount?: string
  [field: string]: unknown
}

/** The `invoice` object of `POST /invoices.json`; the mapping builds the full shape (spec 6c §5.3). */
export interface InvoicePayload {
  oid: string
  buyer_email: string | null
  positions: InvoicePosition[]
  [field: string]: unknown
}

/** One side of a correction position – the line as it was on the invoice, or as it is now. */
export interface CorrectionSide {
  name: string
  quantity: string
  total_price_gross: string
  tax: string
  kind: 'correction_before' | 'correction_after'
}

/** A correction position: the change (`quantity` negative) with the line before and after. */
export interface CorrectionPosition {
  name: string
  quantity: number
  total_price_gross: string
  tax: string
  kind: 'correction'
  correction_before_attributes: CorrectionSide
  correction_after_attributes: CorrectionSide
}

/**
 * The `invoice` object of a credit note (`kind: 'correction'`) – the shape follows the README of
 * `fakturownia/api` and still awaits a check on a live account (spec 6e-b, D3).
 */
export interface CorrectionPayload {
  kind: 'correction'
  invoice_id: string
  from_invoice_id: string
  correction_reason: string
  oid: string
  oid_unique: 'yes'
  buyer_email: string | null
  positions: CorrectionPosition[]
  [field: string]: unknown
}

/** What the shop reads back from Fakturownia. */
export interface FakturowniaInvoice {
  id: string
  number: string
  totalCents: number
  buyerEmail: string | null
  oid: string | null
  govStatus: string | null
  govId: string | null
  govErrors: string | null
}

export interface FakturowniaClient {
  createInvoice(invoice: InvoicePayload): Promise<FakturowniaInvoice>
  /** A credit note is an invoice of kind `correction`: the same endpoint and answers. */
  createCorrection(correction: CorrectionPayload): Promise<FakturowniaInvoice>
  getInvoice(id: string): Promise<FakturowniaInvoice>
  findInvoiceByOid(oid: string): Promise<FakturowniaInvoice | null>
  sendToKsef(id: string): Promise<FakturowniaInvoice>
  downloadPdf(id: string): Promise<Buffer>
}

/**
 * `transient` – worth another try (network, timeout, 5xx, 408, 429); `duplicate` – Fakturownia
 * already has an invoice with this `oid`; `permanent` – anything else, retrying will not help.
 */
export type FakturowniaErrorKind = 'transient' | 'permanent' | 'duplicate'

export class FakturowniaError extends Error {
  constructor(
    readonly kind: FakturowniaErrorKind,
    message: string,
    readonly status: number | null = null,
  ) {
    super(message)
    this.name = 'FakturowniaError'
  }
}

/** zł (number or Fakturownia's decimal string) → integer grosze. */
export function toCents(value: number | string): number {
  return Math.round(Number(value) * 100)
}

const TRANSIENT_STATUSES = new Set([408, 429])

/** Fakturownia's `message` – text or `{ field: [errors] }` – as one line. */
function flatten(message: unknown): string {
  if (typeof message === 'string') return message
  if (message && typeof message === 'object') {
    return Object.entries(message)
      .map(
        ([field, errors]) =>
          `${field}: ${Array.isArray(errors) ? errors.join(', ') : String(errors)}`,
      )
      .join('; ')
  }
  return ''
}

const text = (value: unknown) => (typeof value === 'string' && value ? value : null)

function govErrors(value: unknown): string | null {
  if (Array.isArray(value)) return value.length ? value.map(String).join('; ') : null
  return text(value)
}

function toInvoice(row: Record<string, unknown>): FakturowniaInvoice {
  return {
    id: String(row.id),
    number: String(row.number ?? ''),
    totalCents: toCents(String(row.price_gross ?? '0')),
    buyerEmail: text(row.buyer_email),
    oid: text(row.oid),
    govStatus: text(row.gov_status),
    govId: text(row.gov_id),
    govErrors: govErrors(row.gov_error_messages),
  }
}

/** HTTP client of the Fakturownia API (README of `fakturownia/api`). */
export function createFakturowniaClient(options: {
  url: string
  token: string
  fetch?: typeof globalThis.fetch
  timeoutMs?: number
}): FakturowniaClient {
  const base = options.url.replace(/\/+$/, '')
  const doFetch = options.fetch ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? 30_000
  // The token travels in the URL and may come back in a message – never let it into errors.
  const redact = (value: string) => value.split(options.token).join('***')

  async function send(
    method: 'GET' | 'POST',
    path: string,
    query: Record<string, string> = {},
    body?: Record<string, unknown>,
  ): Promise<Response> {
    const params = new URLSearchParams(
      method === 'GET' ? { api_token: options.token, ...query } : query,
    )
    const search = params.size ? `?${params}` : ''
    try {
      return await doFetch(`${base}${path}${search}`, {
        method,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify({ api_token: options.token, ...body }) } : {}),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (error) {
      const name = (error as { name?: string } | null)?.name
      if (name === 'TimeoutError' || name === 'AbortError') {
        throw new FakturowniaError(
          'transient',
          `Fakturownia nie odpowiedziała w ${Math.ceil(timeoutMs / 1000)} s.`,
        )
      }
      const reason = error instanceof Error ? error.message : String(error)
      throw new FakturowniaError('transient', redact(`Brak połączenia z Fakturownią: ${reason}`))
    }
  }

  async function failed(response: Response): Promise<FakturowniaError> {
    const raw = await response.text()
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = undefined
    }
    const message = (parsed as { message?: unknown } | undefined)?.message
    const detail = redact(flatten(message) || raw.slice(0, 200))
    const status = response.status
    if (status >= 500 || TRANSIENT_STATUSES.has(status)) {
      return new FakturowniaError(
        'transient',
        `Fakturownia nie odpowiada (HTTP ${status}).`,
        status,
      )
    }
    const duplicate =
      status === 422 &&
      Boolean(message) &&
      typeof message === 'object' &&
      'oid' in (message as object)
    return new FakturowniaError(
      duplicate ? 'duplicate' : 'permanent',
      `Fakturownia odrzuciła żądanie (HTTP ${status}): ${detail}`,
      status,
    )
  }

  async function json(response: Response): Promise<unknown> {
    if (!response.ok) throw await failed(response)
    const body = (await response.json()) as unknown
    // Some errors come back with HTTP 200 and `{ code: 'error' }` (KSeF guide of the API).
    if (body && typeof body === 'object' && (body as { code?: unknown }).code === 'error') {
      const detail = redact(flatten((body as { message?: unknown }).message))
      throw new FakturowniaError(
        'permanent',
        `Fakturownia odrzuciła żądanie: ${detail}`,
        response.status,
      )
    }
    return body
  }

  const invoiceAt = async (path: string, query?: Record<string, string>) =>
    toInvoice((await json(await send('GET', path, query))) as Record<string, unknown>)

  async function create(invoice: InvoicePayload | CorrectionPayload) {
    const body = await json(await send('POST', '/invoices.json', {}, { invoice }))
    return toInvoice(body as Record<string, unknown>)
  }

  return {
    createInvoice: create,
    createCorrection: create,
    getInvoice: (id) => invoiceAt(`/invoices/${encodeURIComponent(id)}.json`),
    sendToKsef: (id) =>
      invoiceAt(`/invoices/${encodeURIComponent(id)}.json`, { send_to_ksef: 'yes' }),
    async findInvoiceByOid(oid) {
      // The API documents no `oid` filter – search, then keep only the exact match.
      const rows = await json(
        await send('GET', '/invoices.json', { period: 'all', query: oid, per_page: '25' }),
      )
      const found = (Array.isArray(rows) ? rows : []).find(
        (row) => (row as { oid?: unknown }).oid === oid,
      )
      return found ? toInvoice(found as Record<string, unknown>) : null
    },
    async downloadPdf(id) {
      const response = await send('GET', `/invoices/${encodeURIComponent(id)}.pdf`)
      if (!response.ok) throw await failed(response)
      return Buffer.from(await response.arrayBuffer())
    },
  }
}

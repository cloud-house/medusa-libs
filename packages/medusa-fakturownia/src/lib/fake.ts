import {
  type CorrectionPayload,
  type FakturowniaClient,
  FakturowniaError,
  type FakturowniaInvoice,
  type InvoicePayload,
} from './client'
import { correctionTotalCents } from './correction-mapping'
import { payloadTotalCents } from './mapping'
import { samplePdf } from './pdf'

type FakeFailure = 'transient' | 'permanent' | 'lost'

export interface FakeInvoice {
  id: string
  number: string
  payload: InvoicePayload
  govStatus: string | null
  govId: string | null
  govErrors: string | null
}

export interface FakeCorrection {
  id: string
  number: string
  payload: CorrectionPayload
}

/** State of the in-process fake (spec 6c §5.10) – tests steer it, dev and E2E use it as is. */
export interface FakeState {
  invoices: FakeInvoice[]
  /** Credit notes (spec 6e-b) – numbered on their own, `oid` shared with the invoices. */
  corrections: FakeCorrection[]
  /** What KSeF does with the next send and with invoices still processing. */
  ksef: 'processing' | 'ok' | 'error'
  /** Added to every invoice total read back – simulates Fakturownia counting differently. */
  totalDeltaCents: number
  failures: FakeFailure[]
  failNext(kind: FakeFailure): void
  /** Failures of the next credit notes – a queue apart from the invoices' one. */
  correctionFailures: FakeFailure[]
  failNextCorrection(kind: FakeFailure): void
  /** Failures of the next KSeF sends (the invoice stays outside KSeF, `gov_status` empty). */
  ksefFailures: ('transient' | 'permanent')[]
  failNextKsef(kind: 'transient' | 'permanent'): void
  /** Outages of the next PDF downloads. */
  pdfFailures: number
  failNextPdf(): void
  reset(): void
}

const STATE_KEY = '__fakturowniaFake'

function createState(): FakeState {
  const state: FakeState = {
    invoices: [],
    corrections: [],
    ksef: 'processing',
    totalDeltaCents: 0,
    failures: [],
    failNext(kind) {
      state.failures.push(kind)
    },
    correctionFailures: [],
    failNextCorrection(kind) {
      state.correctionFailures.push(kind)
    },
    ksefFailures: [],
    failNextKsef(kind) {
      state.ksefFailures.push(kind)
    },
    pdfFailures: 0,
    failNextPdf() {
      state.pdfFailures++
    },
    reset() {
      state.invoices = []
      state.corrections = []
      state.correctionFailures = []
      state.ksef = 'processing'
      state.totalDeltaCents = 0
      state.failures = []
      state.ksefFailures = []
      state.pdfFailures = 0
    },
  }
  return state
}

/**
 * One state per process, on `globalThis` – the Medusa app and the test file that steers it may
 * load this module through different module registries.
 */
export function fakeFakturownia(): FakeState {
  const holder = globalThis as typeof globalThis & { [STATE_KEY]?: FakeState }
  holder[STATE_KEY] ??= createState()
  return holder[STATE_KEY]
}

/** A fake Fakturownia account in memory: numbering, unique `oid`, KSeF, a sample PDF. */
export function createFakeClient(state: FakeState = fakeFakturownia()): FakturowniaClient {
  const view = (invoice: FakeInvoice): FakturowniaInvoice => ({
    id: invoice.id,
    number: invoice.number,
    totalCents: payloadTotalCents(invoice.payload) + state.totalDeltaCents,
    buyerEmail: invoice.payload.buyer_email,
    oid: invoice.payload.oid,
    govStatus: invoice.govStatus,
    govId: invoice.govId,
    govErrors: invoice.govErrors,
  })

  const correctionView = (correction: FakeCorrection): FakturowniaInvoice => ({
    id: correction.id,
    number: correction.number,
    totalCents: correctionTotalCents(correction.payload),
    buyerEmail: correction.payload.buyer_email,
    oid: correction.payload.oid,
    govStatus: null,
    govId: null,
    govErrors: null,
  })

  const oidTaken = (oid: string) =>
    state.invoices.some((row) => row.payload.oid === oid) ||
    state.corrections.some((row) => row.payload.oid === oid)

  const find = (id: string) => {
    const invoice = state.invoices.find((row) => row.id === id)
    if (!invoice) throw new FakturowniaError('permanent', `Atrapa: nie ma faktury ${id}.`, 404)
    return invoice
  }

  const settleKsef = (invoice: FakeInvoice) => {
    if (state.ksef === 'ok') {
      invoice.govStatus = 'ok'
      invoice.govId = `KSEF-${invoice.id}`
      invoice.govErrors = null
    } else if (state.ksef === 'error') {
      invoice.govStatus = 'send_error'
      invoice.govErrors = 'Atrapa: KSeF odrzucił fakturę.'
    }
  }

  return {
    async createInvoice(payload) {
      const failure = state.failures.shift()
      if (failure === 'transient') {
        throw new FakturowniaError(
          'transient',
          'Atrapa: Fakturownia nie odpowiada (HTTP 503).',
          503,
        )
      }
      if (failure === 'permanent') {
        throw new FakturowniaError(
          'permanent',
          'Atrapa: Fakturownia odrzuciła żądanie (HTTP 422): buyer_tax_no: jest nieprawidłowy',
          422,
        )
      }
      if (payload.oid_unique === 'yes' && oidTaken(payload.oid)) {
        throw new FakturowniaError(
          'duplicate',
          'Atrapa: Fakturownia odrzuciła żądanie (HTTP 422): oid: jest już zajęte',
          422,
        )
      }
      const now = new Date()
      const sequence = state.invoices.length + 1
      const month = String(now.getUTCMonth() + 1).padStart(2, '0')
      const invoice: FakeInvoice = {
        id: String(1000 + sequence),
        number: `FV ${sequence}/${month}/${now.getUTCFullYear()}`,
        payload: structuredClone(payload),
        govStatus: null,
        govId: null,
        govErrors: null,
      }
      state.invoices.push(invoice)
      if (failure === 'lost') {
        throw new FakturowniaError('transient', 'Atrapa: Fakturownia nie odpowiedziała w 30 s.')
      }
      return view(invoice)
    },
    async createCorrection(payload) {
      const failure = state.correctionFailures.shift()
      if (failure === 'transient') {
        throw new FakturowniaError(
          'transient',
          'Atrapa: Fakturownia nie odpowiada (HTTP 503).',
          503,
        )
      }
      if (failure === 'permanent') {
        throw new FakturowniaError(
          'permanent',
          'Atrapa: Fakturownia odrzuciła żądanie (HTTP 422): positions: korekta jest nieprawidłowa',
          422,
        )
      }
      if (!state.invoices.some((row) => row.id === payload.from_invoice_id)) {
        throw new FakturowniaError(
          'permanent',
          `Atrapa: nie ma faktury ${payload.from_invoice_id}.`,
          404,
        )
      }
      if (payload.oid_unique === 'yes' && oidTaken(payload.oid)) {
        throw new FakturowniaError(
          'duplicate',
          'Atrapa: Fakturownia odrzuciła żądanie (HTTP 422): oid: jest już zajęte',
          422,
        )
      }
      const now = new Date()
      const sequence = state.corrections.length + 1
      const month = String(now.getUTCMonth() + 1).padStart(2, '0')
      const correction: FakeCorrection = {
        id: String(5000 + sequence),
        number: `KOR ${sequence}/${month}/${now.getUTCFullYear()}`,
        payload: structuredClone(payload),
      }
      state.corrections.push(correction)
      if (failure === 'lost') {
        throw new FakturowniaError('transient', 'Atrapa: Fakturownia nie odpowiedziała w 30 s.')
      }
      return correctionView(correction)
    },
    async getInvoice(id) {
      const invoice = find(id)
      if (invoice.govStatus === 'processing') settleKsef(invoice)
      return view(invoice)
    },
    async findInvoiceByOid(oid) {
      const invoice = state.invoices.find((row) => row.payload.oid === oid)
      if (invoice) return view(invoice)
      const correction = state.corrections.find((row) => row.payload.oid === oid)
      return correction ? correctionView(correction) : null
    },
    async sendToKsef(id) {
      const invoice = find(id)
      const failure = state.ksefFailures.shift()
      if (failure === 'transient') {
        throw new FakturowniaError(
          'transient',
          'Atrapa: Fakturownia nie odpowiada (HTTP 503).',
          503,
        )
      }
      if (failure === 'permanent') {
        throw new FakturowniaError(
          'permanent',
          'Atrapa: Fakturownia odrzuciła żądanie: KSeF nie jest połączony z kontem.',
          200,
        )
      }
      invoice.govStatus = 'processing'
      settleKsef(invoice)
      return view(invoice)
    },
    async downloadPdf(id) {
      const invoice = find(id)
      if (state.pdfFailures > 0) {
        state.pdfFailures--
        throw new FakturowniaError(
          'transient',
          'Atrapa: Fakturownia nie odpowiada (HTTP 503).',
          503,
        )
      }
      return samplePdf(`Faktura ${invoice.number}`)
    },
  }
}

import type { Logger, MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import { FAKTUROWNIA_MODULE } from '../modules/fakturownia'
import type FakturowniaModuleService from '../modules/fakturownia/service'
import type { CorrectionRow } from '../modules/fakturownia/service'
import type { ReturnRow } from '../types'
import {
  type CorrectionPayload,
  type FakturowniaClient,
  FakturowniaError,
  type FakturowniaInvoice,
} from './client'
import type { FakturowniaConfig } from './config'
import { clientFor } from './connect'
import { correctionTotalCents, toCorrectionPayload, wholeOrderReturned } from './correction-mapping'
import { InvoiceMappingError } from './mapping'
import { sendInvoiceAlert } from './notify'
import { invoicingConfig, logPrefix, pluginOptions } from './plugin-options'
import { alertDue, attemptDue, dueBy, nextAttemptAt, STALE_ISSUING_MS } from './schedule'

const LOCK_TIMEOUT_S = 120
/** How both locking providers (in-memory, Redis) end a wait that ran out. */
const LOCK_TIMED_OUT = 'Timed-out acquiring lock.'
/** Received returns the job still looks for, and `attention` rows it still re-checks (D3). */
const SWEEP_WINDOW_MS = 30 * 24 * 60 * 60_000

/** Another pass held the order's lock for the whole wait – that pass does the work. */
class CorrectionBusyError extends Error {
  constructor(orderId: string) {
    super(`Korekty zamówienia ${orderId} są właśnie przetwarzane.`)
    this.name = 'CorrectionBusyError'
  }
}

interface Context {
  container: MedusaContainer
  config: FakturowniaConfig
  client: FakturowniaClient
  corrections: FakturowniaModuleService
  logger: Logger
  now: Date
}

type RowChange = Partial<
  Omit<CorrectionRow, 'id' | 'return_id' | 'order_id' | 'created_at' | 'updated_at' | 'deleted_at'>
>
type AttentionReason = NonNullable<CorrectionRow['attention_reason']>
/** The stored shape of `invoice_correction.items`. */
type Piece = { item_id: string; quantity: number }

/** Who an alert or a log line is about. */
interface Subject {
  order: { id: string; displayId: number }
  returnNumber: number
}

/** Workflow and module errors may come as plain objects with `message`. */
const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : String((error as { message?: unknown } | null)?.message ?? error)

const kindOf = (error: unknown): 'transient' | 'permanent' =>
  error instanceof FakturowniaError && error.kind === 'permanent' ? 'permanent' : 'transient'

const moduleOf = (container: MedusaContainer) =>
  container.resolve<FakturowniaModuleService>(FAKTUROWNIA_MODULE)

function context(container: MedusaContainer, now: Date): Context | null {
  const config = invoicingConfig(container)
  if (!config) return null
  return {
    container,
    config,
    client: clientFor(config),
    corrections: moduleOf(container),
    logger: container.resolve(ContainerRegistrationKeys.LOGGER),
    now,
  }
}

/**
 * One pass per ORDER at a time (D3): the delivery line and the quantities „before” a note depend
 * on all returns of the order. The unique `return_id` keeps one row per return on its own.
 */
async function locked<T>(
  container: MedusaContainer,
  orderId: string,
  job: () => Promise<T>,
): Promise<T> {
  try {
    return await container
      .resolve(Modules.LOCKING)
      .execute(`correction:${orderId}`, job, { timeout: LOCK_TIMEOUT_S })
  } catch (error) {
    if (errorText(error) === LOCK_TIMED_OUT) throw new CorrectionBusyError(orderId)
    throw error
  }
}

const busyLine = (container: MedusaContainer, returnId: string, orderId: string) =>
  `${logPrefix(container)} Korekta do zwrotu ${returnId} – inny przebieg pracuje nad korektami zamówienia ${orderId}.`

async function save(ctx: Context, row: CorrectionRow, change: RowChange): Promise<CorrectionRow> {
  return (await ctx.corrections.updateInvoiceCorrections({
    id: row.id,
    ...change,
  })) as CorrectionRow
}

const piecesOf = (row: CorrectionRow): Piece[] =>
  Array.isArray(row.items) ? (row.items as unknown as Piece[]) : []

const stored = (pieces: Piece[]) => pieces as unknown as CorrectionRow['items']

/**
 * What the return brings back: `items[].quantity` – a return is `received` only once all of it
 * came; Medusa overwrites `received_quantity` when one line is received in two sessions.
 */
function returnedPieces(found: ReturnRow): Piece[] {
  const byItem = new Map<string, number>()
  for (const line of found.items) {
    if (line.quantity > 0) byItem.set(line.itemId, (byItem.get(line.itemId) ?? 0) + line.quantity)
  }
  return [...byItem].map(([item_id, quantity]) => ({ item_id, quantity }))
}

const time = (value: Date | string | null) => (value ? new Date(value).getTime() : null)

/** Whether a pass works on the row now; repeated events and the job must not hammer it. */
function needsWork(row: CorrectionRow, now: Date): boolean {
  switch (row.status) {
    case 'waiting':
    case 'attention':
      return true
    case 'failed':
      return (
        row.error_kind === 'transient' &&
        attemptDue(row.next_attempt_at ? new Date(row.next_attempt_at) : null, now)
      )
    case 'issuing':
      // Under the lock an `issuing` row was left by a crash; give a running process time anyway.
      return now.getTime() - (time(row.updated_at) ?? 0) >= STALE_ISSUING_MS
    default:
      return false
  }
}

/**
 * A note that may already be in Fakturownia while the shop does not know it: sent and not answered
 * (`issuing`), or failing and still retried. Another note of the order waits for it – its
 * quantities „before” and the delivery line depend on it.
 */
const unsettled = (row: CorrectionRow) =>
  row.status === 'issuing' ||
  (row.status === 'failed' && row.error_kind === 'transient' && row.next_attempt_at !== null)

async function orderOf(container: MedusaContainer, orderId: string): Promise<Subject['order']> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: 'order',
    fields: ['display_id'],
    filters: { id: orderId },
  })
  const displayId = (data[0] as unknown as { display_id?: number } | undefined)?.display_id
  return { id: orderId, displayId: Number(displayId ?? 0) }
}

/** One alert per problem, like the invoice's (spec 6c §5.6); one that cannot go out is logged. */
async function alert(
  ctx: Context,
  row: CorrectionRow,
  subject: Subject,
  problem: AttentionReason | 'issue',
  message: string,
): Promise<CorrectionRow> {
  const key = `correction:${problem}`
  if (row.alerted_for === key) return row
  try {
    // Two returns of one order may alert in the same pass – the key carries the return.
    const sent = await sendInvoiceAlert(
      ctx.container,
      subject.order,
      'correction',
      message,
      ctx.now,
      row.return_id,
    )
    return sent ? await save(ctx, row, { alerted_for: key }) : row
  } catch (error) {
    ctx.logger.error(
      `${logPrefix(ctx.container)} Alert o korekcie do zamówienia #${subject.order.displayId} nie wyszedł: ${errorText(error)}`,
    )
    return row
  }
}

/** The note waits for a person or for the invoice; a pass that finds the same leaves the row be. */
async function attention(
  ctx: Context,
  row: CorrectionRow,
  subject: Subject,
  reason: AttentionReason,
  message: string,
): Promise<CorrectionRow> {
  const held =
    row.status === 'attention' && row.attention_reason === reason
      ? row
      : await save(ctx, row, {
          status: 'attention',
          attention_reason: reason,
          last_error: null,
          error_kind: null,
          problem_since: null,
          next_attempt_at: null,
        })
  return alert(ctx, held, subject, reason, message)
}

async function failIssue(
  ctx: Context,
  row: CorrectionRow,
  subject: Subject,
  kind: 'transient' | 'permanent',
  message: string,
): Promise<CorrectionRow> {
  const problemSince = row.problem_since ? new Date(row.problem_since) : ctx.now
  const about = `Korekta do zwrotu #${subject.returnNumber} zamówienia #${subject.order.displayId}`
  if (kind === 'permanent') {
    ctx.logger.error(`${logPrefix(ctx.container)} ${about} nie powstała: ${message}`)
    const failed = await save(ctx, row, {
      status: 'failed',
      error_kind: 'permanent',
      last_error: message,
      problem_since: problemSince,
      next_attempt_at: null,
    })
    return alert(ctx, failed, subject, 'issue', message)
  }
  const next = nextAttemptAt(problemSince, ctx.now)
  ctx.logger.warn(
    `${logPrefix(ctx.container)} ${about} nie powstała (${next ? 'ponowimy' : 'koniec prób'}): ${message}`,
  )
  const failed = await save(ctx, row, {
    status: 'failed',
    error_kind: 'transient',
    last_error: message,
    problem_since: problemSince,
    next_attempt_at: next,
  })
  return alertDue(problemSince, ctx.now) || !next
    ? alert(ctx, failed, subject, 'issue', message)
    : failed
}

/** Pins the note Fakturownia has to the row. */
async function attach(
  ctx: Context,
  row: CorrectionRow,
  note: FakturowniaInvoice,
  payload: CorrectionPayload,
): Promise<CorrectionRow> {
  return save(ctx, row, {
    status: 'issued',
    fakturownia_id: note.id,
    number: note.number,
    total_cents: correctionTotalCents(payload),
    attention_reason: null,
    last_error: null,
    error_kind: null,
    problem_since: null,
    next_attempt_at: null,
    alerted_for: null,
  })
}

/** A note with exactly this `oid` – one an earlier attempt made and lost the answer of. */
async function lookUp(ctx: Context, oid: string): Promise<FakturowniaInvoice | null> {
  const found = await ctx.client.findInvoiceByOid(oid)
  return found?.oid === oid ? found : null
}

async function attachFound(
  ctx: Context,
  row: CorrectionRow,
  subject: Subject,
  note: FakturowniaInvoice,
  payload: CorrectionPayload,
): Promise<CorrectionRow> {
  ctx.logger.info(
    `${logPrefix(ctx.container)} Korekta ${payload.oid} już była w Fakturowni – przypięta do zwrotu #${subject.returnNumber}.`,
  )
  return attach(ctx, row, note, payload)
}

/** Fakturownia refused the `oid`: the note is ours only when the search finds that exact `oid`. */
async function recoverDuplicate(
  ctx: Context,
  row: CorrectionRow,
  subject: Subject,
  payload: CorrectionPayload,
): Promise<CorrectionRow> {
  let sent: FakturowniaInvoice | null
  try {
    sent = await lookUp(ctx, payload.oid)
  } catch (error) {
    return failIssue(ctx, row, subject, kindOf(error), errorText(error))
  }
  if (sent) return attachFound(ctx, row, subject, sent, payload)
  return failIssue(
    ctx,
    row,
    subject,
    'permanent',
    `Korekta do zwrotu #${subject.returnNumber} już jest w Fakturowni – sprawdź ją tam.`,
  )
}

/** The whole order came back and no issued note of it gave back the delivery yet (D4). */
async function deliveryDue(
  ctx: Context,
  orderId: string,
  issued: CorrectionRow[],
): Promise<boolean> {
  if (issued.some((other) => other.includes_shipping)) return false
  const order = await pluginOptions(ctx.container).resolveReturnOrder(ctx.container, orderId)
  return order ? wholeOrderReturned(order.items.map((item) => item.quantities)) : false
}

async function issue(
  ctx: Context,
  row: CorrectionRow,
  subject: Subject,
  found: ReturnRow,
  invoiceFakturowniaId: string,
  others: CorrectionRow[],
): Promise<CorrectionRow> {
  const order = await pluginOptions(ctx.container).resolveOrder(ctx.container, row.order_id)
  if (!order) return row
  const issued = others.filter((other) => other.status === 'issued')
  const returned = returnedPieces(found)
  // A retry sends the note its first attempt sent: that attempt may be in Fakturownia already,
  // and another return received meanwhile must not move the delivery line onto it.
  const shipping =
    row.attempts > 0 ? row.includes_shipping : await deliveryDue(ctx, row.order_id, issued)
  const claimed = await save(ctx, row, {
    status: 'issuing',
    attempts: row.attempts + 1,
    attention_reason: null,
    items: stored(returned),
    includes_shipping: shipping,
  })

  let payload: CorrectionPayload
  try {
    payload = toCorrectionPayload(
      {
        order,
        invoiceFakturowniaId,
        returnDisplayId: found.displayId,
        returned: returned.map((piece) => ({ itemId: piece.item_id, quantity: piece.quantity })),
        corrected: issued
          .flatMap(piecesOf)
          .map((piece) => ({ itemId: piece.item_id, quantity: piece.quantity })),
        shipping,
      },
      ctx.config,
      ctx.now,
    )
  } catch (error) {
    if (error instanceof InvoiceMappingError) {
      return failIssue(ctx, claimed, subject, 'permanent', error.message)
    }
    throw error
  }

  try {
    if (claimed.attempts > 1) {
      // Look first: Fakturownia may not refuse a second correction with the same `oid`.
      const sent = await lookUp(ctx, payload.oid)
      if (sent) return await attachFound(ctx, claimed, subject, sent, payload)
    }
    return await attach(ctx, claimed, await ctx.client.createCorrection(payload), payload)
  } catch (error) {
    if (error instanceof FakturowniaError && error.kind === 'duplicate') {
      return recoverDuplicate(ctx, claimed, subject, payload)
    }
    return failIssue(ctx, claimed, subject, kindOf(error), errorText(error))
  }
}

async function step(ctx: Context, returnId: string): Promise<CorrectionRow | null> {
  const row = await ctx.corrections.findCorrectionByReturn(returnId)
  if (!row || !needsWork(row, ctx.now)) return row
  const found = await pluginOptions(ctx.container).resolveReturn(ctx.container, returnId)
  if (!found) return row
  const subject: Subject = {
    order: await orderOf(ctx.container, row.order_id),
    returnNumber: found.displayId,
  }
  const n = found.displayId

  if (found.status === 'partially_received') {
    return attention(
      ctx,
      row,
      subject,
      'partial_receipt',
      `Zwrot #${n} przyjęty częściowo – korekta powstanie po przyjęciu wszystkich pozycji. Jeśli reszta nie wróci, wystaw korektę ręcznie w Fakturowni.`,
    )
  }
  if (found.status !== 'received') return row

  const invoice = await ctx.corrections.findByOrder(row.order_id)
  if (!invoice) {
    return attention(
      ctx,
      row,
      subject,
      'no_invoice',
      `Zwrot #${n} przyjęty, ale zamówienie nie ma faktury w Fakturowni – wystaw korektę ręcznie albo najpierw fakturę.`,
    )
  }
  if (invoice.status !== 'issued' || !invoice.fakturownia_id) {
    return attention(
      ctx,
      row,
      subject,
      'invoice_not_ready',
      `Zwrot #${n} przyjęty, ale faktura do zamówienia nie jest wystawiona (stan: ${invoice.status}) – korekta poczeka na fakturę.`,
    )
  }

  const others = (await ctx.corrections.correctionsOfOrder(row.order_id)).filter(
    (other) => other.id !== row.id,
  )
  if (others.some(unsettled)) {
    ctx.logger.info(
      `${logPrefix(ctx.container)} Korekta do zwrotu #${n} zamówienia #${subject.order.displayId} czeka na wynik wcześniejszej korekty tego zamówienia.`,
    )
    return row.status === 'attention'
      ? save(ctx, row, { status: 'waiting', attention_reason: null })
      : row
  }
  return issue(ctx, row, subject, found, invoice.fakturownia_id, others)
}

/**
 * `order.return_received` and the job: the correction row of a received return of a shop order
 * (D3). `null` without Fakturownia, for an order not placed in the shop and for the return of a
 * claim or an exchange made in the Medusa admin.
 */
export async function ensureCorrectionRow(
  container: MedusaContainer,
  orderId: string,
  returnId: string,
): Promise<CorrectionRow | null> {
  if (!invoicingConfig(container)) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .info(
        `${logPrefix(container)} Fakturownia nie jest skonfigurowana – zwrot ${returnId} bez korekty.`,
      )
    return null
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const [{ data: links }, { data: returns }] = await Promise.all([
    query.graph({ entity: 'order_cart', fields: ['cart_id'], filters: { order_id: orderId } }),
    query.graph({
      entity: 'return',
      fields: ['claim_id', 'exchange_id'],
      filters: { id: returnId },
    }),
  ])
  if (!links.length) return null
  // A claim or an exchange in the Medusa admin is not a withdrawal: the sale stands (a replacement
  // goes out), so no credit note is made for it automatically.
  const found = returns[0] as unknown as { claim_id?: string | null; exchange_id?: string | null }
  if (found?.claim_id || found?.exchange_id) {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .info(
        `${logPrefix(container)} Zwrot ${returnId} należy do wymiany albo reklamacji w Medusie – korekta faktury nie powstaje automatycznie.`,
      )
    return null
  }
  return moduleOf(container).ensureCorrectionForReturn(orderId, returnId)
}

/**
 * Moves the return's credit note as far as it can go now (D3–D5): a received return of an order
 * with an issued invoice gets its note; a partial receipt or a missing invoice holds the row with
 * one alert. Never touches the return in Medusa.
 */
export async function processCorrection(
  container: MedusaContainer,
  returnId: string,
  options: { now?: Date } = {},
): Promise<CorrectionRow | null> {
  const ctx = context(container, options.now ?? new Date())
  if (!ctx) return null
  const row = await ctx.corrections.findCorrectionByReturn(returnId)
  if (!row) return null
  if (row.status === 'issued') return row
  try {
    return await locked(container, row.order_id, () => step(ctx, returnId))
  } catch (error) {
    if (!(error instanceof CorrectionBusyError)) throw error
    ctx.logger.info(busyLine(ctx.container, returnId, row.order_id))
    return null
  }
}

/**
 * The job's pass (every 15 minutes, after the invoices): rows for returns received without an
 * event, then every row that can move on now – oldest first, so the notes of an order go in turn.
 */
export async function sweepCorrections(
  container: MedusaContainer,
  now = new Date(),
): Promise<{ processed: number }> {
  const ctx = context(container, now)
  if (!ctx) return { processed: 0 }
  const since = new Date(now.getTime() - SWEEP_WINDOW_MS)

  // `receiveAndCompleteReturnOrderWorkflow` emits no event, and an event can be lost. Returns of
  // claims and exchanges never get a note automatically (`ensureCorrectionRow`).
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: 'return',
    fields: ['id', 'order_id'],
    // The generated query types do not know the claim/exchange columns of the return.
    filters: {
      status: 'received',
      received_at: { $gte: since },
      claim_id: null,
      exchange_id: null,
    } as never,
  })
  const received = data as unknown as { id: string; order_id: string }[]
  const known = new Set(
    received.length
      ? (
          await ctx.corrections.listInvoiceCorrections(
            { return_id: received.map((found) => found.id) },
            { select: ['return_id'], take: null },
          )
        ).map((row) => row.return_id)
      : [],
  )
  for (const found of received) {
    if (known.has(found.id)) continue
    try {
      await ensureCorrectionRow(container, found.order_id, found.id)
    } catch (error) {
      ctx.logger.warn(
        `${logPrefix(ctx.container)} Przegląd korekty do zwrotu ${found.id}: ${errorText(error)}`,
      )
    }
  }

  const list = (filters: Record<string, unknown>) =>
    ctx.corrections.listInvoiceCorrections(filters, {
      select: ['id', 'return_id', 'order_id', 'created_at'],
      take: null,
    })
  const groups = await Promise.all([
    list({ status: 'waiting' }),
    list({ status: 'attention', updated_at: { $gte: since } }),
    list({ status: 'failed', error_kind: 'transient', next_attempt_at: { $lte: dueBy(now) } }),
    list({ status: 'issuing', updated_at: { $lt: new Date(now.getTime() - STALE_ISSUING_MS) } }),
  ])
  const rows = [...new Map(groups.flat().map((row) => [row.id, row])).values()].sort(
    (a, b) => (time(a.created_at) ?? 0) - (time(b.created_at) ?? 0) || a.id.localeCompare(b.id),
  )
  let processed = 0
  for (const row of rows) {
    try {
      await locked(container, row.order_id, () => step(ctx, row.return_id))
      processed++
    } catch (error) {
      if (error instanceof CorrectionBusyError) {
        ctx.logger.info(busyLine(ctx.container, row.return_id, row.order_id))
        continue
      }
      ctx.logger.warn(
        `${logPrefix(ctx.container)} Przegląd korekty do zwrotu ${row.return_id}: ${errorText(error)}`,
      )
    }
  }
  return { processed }
}

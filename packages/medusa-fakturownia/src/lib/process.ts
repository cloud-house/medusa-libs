import { formatPrice } from '@cloud-house/commerce-rules'
import type { Logger, MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import { FAKTUROWNIA_MODULE } from '../modules/fakturownia'
import type FakturowniaModuleService from '../modules/fakturownia/service'
import type { InvoiceRow } from '../modules/fakturownia/service'
import type { InvoiceAlertKind, InvoiceOrder } from '../types'
import {
  type FakturowniaClient,
  FakturowniaError,
  type FakturowniaInvoice,
  type InvoicePayload,
} from './client'
import type { FakturowniaConfig } from './config'
import { clientFor } from './connect'
import { buyerKind, InvoiceMappingError, toInvoicePayload } from './mapping'
import { invoiceFilename, sendInvoiceAlert, sendInvoiceEmail } from './notify'
import { invoicingConfig, logPrefix, pluginOptions } from './plugin-options'
import {
  alertDue,
  attemptDue,
  dueBy,
  nextAttemptAt,
  STALE_ISSUING_MS,
  UNPAID_SKIP_AFTER_MS,
} from './schedule'
import { invoiceReady, ksefFromGovStatus, ksefRequired } from './state'

/** An admin request that cannot be done now – the message goes to the invoice card. */
export class InvoiceActionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvoiceActionError'
  }
}

/** Fakturownia did not hand over the PDF now – the download answers 503. */
export class InvoicePdfUnavailableError extends Error {
  constructor() {
    super('Nie udało się pobrać faktury z Fakturowni – spróbuj ponownie za kilka minut.')
    this.name = 'InvoicePdfUnavailableError'
  }
}

/** Another pass held the order's lock for the whole wait – that pass does the work. */
class InvoiceBusyError extends InvoiceActionError {
  constructor() {
    super('Faktura do tego zamówienia jest właśnie przetwarzana – spróbuj za chwilę.')
  }
}

const LOCK_TIMEOUT_S = 120
/** How both locking providers (in-memory, Redis) end a wait that ran out. */
const LOCK_TIMED_OUT = 'Timed-out acquiring lock.'
/** A row skipped for lack of payment comes back when the payment arrives within this time. */
const REVIVE_UNPAID_MS = 30 * 24 * 60 * 60_000
/**
 * An issued invoice still waiting for KSeF or its e-mail is re-read by the job only while its
 * row changed within this time – a problem left for a month is the team's to finish by hand.
 */
const REREAD_ISSUED_MS = 30 * 24 * 60 * 60_000

interface Context {
  container: MedusaContainer
  config: FakturowniaConfig
  client: FakturowniaClient
  invoices: FakturowniaModuleService
  logger: Logger
  now: Date
}

type RowChange = Partial<Omit<InvoiceRow, 'id' | 'order_id' | 'created_at' | 'updated_at'>>

/** Workflow and module errors may come as plain objects with `message`. */
const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : String((error as { message?: unknown } | null)?.message ?? error)

const moduleOf = (container: MedusaContainer) =>
  container.resolve<FakturowniaModuleService>(FAKTUROWNIA_MODULE)

function context(container: MedusaContainer, now: Date): Context | null {
  const config = invoicingConfig(container)
  if (!config) return null
  return {
    container,
    config,
    client: clientFor(config),
    invoices: moduleOf(container),
    logger: container.resolve(ContainerRegistrationKeys.LOGGER),
    now,
  }
}

/** One pass per order at a time – events, the job and the admin may meet (spec 6c §5.2). */
async function locked<T>(
  container: MedusaContainer,
  orderId: string,
  job: () => Promise<T>,
): Promise<T> {
  try {
    return await container
      .resolve(Modules.LOCKING)
      .execute(`invoice:${orderId}`, job, { timeout: LOCK_TIMEOUT_S })
  } catch (error) {
    if (errorText(error) === LOCK_TIMED_OUT) throw new InvoiceBusyError()
    throw error
  }
}

const busyLine = (container: MedusaContainer, orderId: string) =>
  `${logPrefix(container)} Faktura do zamówienia ${orderId} – inny przebieg już nad nią pracuje.`

async function save(ctx: Context, row: InvoiceRow, change: RowChange): Promise<InvoiceRow> {
  return (await ctx.invoices.updateInvoices({ id: row.id, ...change })) as InvoiceRow
}

const time = (value: Date | string | null) => (value ? new Date(value).getTime() : null)

/** No failing step, or the failing step's next try has come; `false` once retries gave up. */
function due(row: InvoiceRow, now: Date): boolean {
  if (!row.problem_since) return true
  return attemptDue(row.next_attempt_at ? new Date(row.next_attempt_at) : null, now)
}

/** One alert per problem (spec 6c §5.6); an alert that cannot go out is only logged. */
async function alert(
  ctx: Context,
  row: InvoiceRow,
  order: InvoiceOrder,
  kind: InvoiceAlertKind,
  message: string,
): Promise<InvoiceRow> {
  if (row.alerted_for === kind) return row
  try {
    const sent = await sendInvoiceAlert(ctx.container, order, kind, message, ctx.now)
    return sent ? await save(ctx, row, { alerted_for: kind }) : row
  } catch (error) {
    ctx.logger.error(
      `${logPrefix(ctx.container)} Alert o fakturze do zamówienia #${order.displayId} nie wyszedł: ${errorText(error)}`,
    )
    return row
  }
}

async function failIssue(
  ctx: Context,
  row: InvoiceRow,
  order: InvoiceOrder,
  kind: 'transient' | 'permanent',
  message: string,
): Promise<InvoiceRow> {
  const problemSince = row.problem_since ? new Date(row.problem_since) : ctx.now
  if (kind === 'permanent') {
    ctx.logger.error(
      `${logPrefix(ctx.container)} Faktura do zamówienia #${order.displayId} nie powstała: ${message}`,
    )
    const failed = await save(ctx, row, {
      status: 'failed',
      error_kind: 'permanent',
      last_error: message,
      problem_since: problemSince,
      next_attempt_at: null,
    })
    return alert(ctx, failed, order, 'issue', message)
  }
  const next = nextAttemptAt(problemSince, ctx.now)
  ctx.logger.warn(
    `${logPrefix(ctx.container)} Faktura do zamówienia #${order.displayId} nie powstała (${next ? 'ponowimy' : 'koniec prób'}): ${message}`,
  )
  const failed = await save(ctx, row, {
    status: 'failed',
    error_kind: 'transient',
    last_error: message,
    problem_since: problemSince,
    next_attempt_at: next,
  })
  return alertDue(problemSince, ctx.now) || !next
    ? alert(ctx, failed, order, 'issue', message)
    : failed
}

/** Pins a Fakturownia invoice to the row; a total that differs holds it for a check (§5.3). */
async function attach(
  ctx: Context,
  row: InvoiceRow,
  order: InvoiceOrder,
  invoice: FakturowniaInvoice,
): Promise<InvoiceRow> {
  const difference = invoice.totalCents - order.totalCents
  const inKsef = ksefRequired(ctx.config.ksef, buyerKind(order))
  const change: RowChange = {
    fakturownia_id: invoice.id,
    number: invoice.number,
    ksef: inKsef ? 'pending' : 'none',
    ksef_number: null,
    ksef_error: null,
    last_error: null,
    error_kind: null,
    problem_since: null,
    next_attempt_at: null,
    alerted_for: null,
  }
  if (difference === 0) {
    const issued = await save(ctx, row, { ...change, status: 'issued', difference_cents: null })
    // An invoice found after a lost answer may be in KSeF already – take its status, not send.
    return inKsef && invoice.govStatus !== null ? applyKsef(ctx, issued, order, invoice) : issued
  }
  const held = await save(ctx, row, { ...change, status: 'review', difference_cents: difference })
  return alert(
    ctx,
    held,
    order,
    'total',
    `Suma faktury ${invoice.number} (${formatPrice(invoice.totalCents / 100)}) różni się od zamówienia (${formatPrice(order.totalCents / 100)}) o ${formatPrice(Math.abs(difference) / 100)}.`,
  )
}

/**
 * Fakturownia refused the `oid` – an earlier try may have created the invoice and lost the
 * answer. Only an invoice with the same `oid`, buyer e-mail and total is ours (spec 6c §5.2).
 */
async function recoverDuplicate(
  ctx: Context,
  row: InvoiceRow,
  order: InvoiceOrder,
  payload: InvoicePayload,
): Promise<InvoiceRow> {
  let found: FakturowniaInvoice | null
  try {
    found = await ctx.client.findInvoiceByOid(payload.oid)
  } catch (error) {
    const permanent = error instanceof FakturowniaError && error.kind === 'permanent'
    return failIssue(ctx, row, order, permanent ? 'permanent' : 'transient', errorText(error))
  }
  const sameEmail = (found?.buyerEmail ?? '').toLowerCase() === (order.email ?? '').toLowerCase()
  if (found && found.oid === payload.oid && sameEmail && found.totalCents === order.totalCents) {
    return attach(ctx, row, order, found)
  }
  return failIssue(
    ctx,
    row,
    order,
    'permanent',
    `Faktura do zamówienia #${order.displayId} już jest w Fakturowni – sprawdź ją tam.`,
  )
}

function needsIssue(row: InvoiceRow, order: InvoiceOrder, now: Date, manual: boolean): boolean {
  switch (row.status) {
    case 'waiting':
      return true
    case 'failed':
      return manual || (row.error_kind === 'transient' && due(row, now))
    case 'issuing':
      // Under the lock an `issuing` row was left by a crash; give a running process time anyway.
      return manual || now.getTime() - (time(row.updated_at) ?? 0) >= STALE_ISSUING_MS
    case 'skipped':
      return manual || (row.skip_reason === 'unpaid' && order.paid && !order.canceled)
    default:
      return false
  }
}

async function issue(
  ctx: Context,
  row: InvoiceRow,
  order: InvoiceOrder,
  manual: boolean,
): Promise<InvoiceRow> {
  if (order.canceled) {
    if (manual) throw new InvoiceActionError('Zamówienie jest anulowane – faktury nie wystawiamy.')
    return save(ctx, row, {
      status: 'skipped',
      skip_reason: 'canceled',
      problem_since: null,
      next_attempt_at: null,
    })
  }
  if (!order.paid) {
    if (manual) throw new InvoiceActionError('Zamówienie nie jest opłacone.')
    const unpaidFor = ctx.now.getTime() - order.createdAt.getTime()
    if (row.status === 'waiting' && unpaidFor >= UNPAID_SKIP_AFTER_MS) {
      return save(ctx, row, { status: 'skipped', skip_reason: 'unpaid' })
    }
    return row
  }

  const claimed = await save(ctx, row, {
    status: 'issuing',
    skip_reason: null,
    attempts: row.attempts + 1,
    buyer_kind: buyerKind(order),
    // A click in the admin starts the retries and the alert anew.
    ...(manual ? { problem_since: null, next_attempt_at: null, alerted_for: null } : {}),
  })
  let payload: InvoicePayload
  try {
    payload = toInvoicePayload(
      order,
      ctx.config,
      ctx.now,
      pluginOptions(ctx.container).paymentTypes,
    )
  } catch (error) {
    if (error instanceof InvoiceMappingError) {
      return failIssue(ctx, claimed, order, 'permanent', error.message)
    }
    throw error
  }
  try {
    return await attach(ctx, claimed, order, await ctx.client.createInvoice(payload))
  } catch (error) {
    if (!(error instanceof FakturowniaError)) {
      return failIssue(ctx, claimed, order, 'transient', errorText(error))
    }
    if (error.kind === 'duplicate') return recoverDuplicate(ctx, claimed, order, payload)
    return failIssue(ctx, claimed, order, error.kind, error.message)
  }
}

/** A KSeF or e-mail step failed: retried like issuing, permanent errors stop at once. */
async function failStep(
  ctx: Context,
  row: InvoiceRow,
  order: InvoiceOrder,
  kind: 'ksef' | 'email',
  error: unknown,
): Promise<InvoiceRow> {
  const message = errorText(error)
  const permanent = error instanceof FakturowniaError && error.kind === 'permanent'
  const problemSince = row.problem_since ? new Date(row.problem_since) : ctx.now
  const next = permanent ? null : nextAttemptAt(problemSince, ctx.now)
  ctx.logger.warn(
    `${logPrefix(ctx.container)} Faktura do zamówienia #${order.displayId} – ${kind === 'ksef' ? 'wysyłka do KSeF' : 'mail'} nie wyszła: ${message}`,
  )
  const failed = await save(ctx, row, {
    ...(kind === 'ksef'
      ? { ksef: permanent ? 'error' : 'pending', ksef_error: message }
      : { email_error: message, email_attempts: row.email_attempts + 1 }),
    problem_since: problemSince,
    next_attempt_at: next,
  })
  return permanent || !next || alertDue(problemSince, ctx.now)
    ? alert(ctx, failed, order, kind, message)
    : failed
}

async function applyKsef(
  ctx: Context,
  row: InvoiceRow,
  order: InvoiceOrder,
  invoice: FakturowniaInvoice,
  justSent = false,
): Promise<InvoiceRow> {
  // An empty `gov_status` means „sent, no answer yet” only right after a send the shop made, or
  // for a row already `sent`. A refused send (`error`) or given-up sends (`pending`) never reached
  // KSeF – only a real status from Fakturownia (the team sent it there) moves them on.
  const outside = row.ksef === 'error' || row.ksef === 'pending'
  if (!justSent && invoice.govStatus === null && outside) return row
  const state = ksefFromGovStatus(invoice.govStatus)
  if (state === 'error') {
    const message = invoice.govErrors ?? `KSeF: ${invoice.govStatus ?? 'brak statusu'}`
    const failed =
      row.ksef === 'error' && row.ksef_error === message
        ? row
        : await save(ctx, row, {
            ksef: 'error',
            ksef_error: message,
            problem_since: null,
            next_attempt_at: null,
          })
    return alert(ctx, failed, order, 'ksef', message)
  }
  if (state === row.ksef && invoice.govId === row.ksef_number && !row.ksef_error) return row
  return save(ctx, row, {
    ksef: state,
    ksef_number: invoice.govId,
    ksef_error: null,
    problem_since: null,
    next_attempt_at: null,
    ...(row.alerted_for === 'ksef' ? { alerted_for: null } : {}),
  })
}

async function mail(
  ctx: Context,
  row: InvoiceRow,
  order: InvoiceOrder,
  idempotencyKey: string,
): Promise<InvoiceRow> {
  try {
    if (!order.email) throw new Error('Zamówienie nie ma adresu e-mail.')
    const pdf = await ctx.client.downloadPdf(row.fakturownia_id as string)
    await sendInvoiceEmail(ctx.container, row, order, pdf, idempotencyKey)
  } catch (error) {
    return failStep(ctx, row, order, 'email', error)
  }
  return save(ctx, row, {
    email_sent_at: ctx.now,
    email_error: null,
    email_attempts: row.email_attempts + 1,
    problem_since: null,
    next_attempt_at: null,
    ...(row.alerted_for === 'email' ? { alerted_for: null } : {}),
  })
}

/** After issuing: KSeF when needed (§5.4), then the e-mail once the invoice is ready (§5.5). */
async function afterIssue(ctx: Context, row: InvoiceRow, order: InvoiceOrder): Promise<InvoiceRow> {
  let current = row
  const id = current.fakturownia_id as string
  if (current.ksef === 'pending' && due(current, ctx.now)) {
    try {
      // The send went through: an empty status now means KSeF is still working on it.
      current = await applyKsef(ctx, current, order, await ctx.client.sendToKsef(id), true)
    } catch (error) {
      return failStep(ctx, current, order, 'ksef', error)
    }
  }
  // `error` and given-up `pending` too: the team may send the invoice to KSeF in Fakturownia,
  // and once KSeF gives the number the shop sends the e-mail (spec 6c §5.4).
  if (
    current.ksef === 'sent' ||
    current.ksef === 'error' ||
    (current.ksef === 'pending' && !due(current, ctx.now))
  ) {
    try {
      current = await applyKsef(ctx, current, order, await ctx.client.getInvoice(id))
    } catch (error) {
      ctx.logger.warn(
        `${logPrefix(ctx.container)} Stan KSeF faktury do zamówienia #${order.displayId} nieznany: ${errorText(error)}`,
      )
      return current
    }
  }
  if (invoiceReady(current) && !current.email_sent_at && due(current, ctx.now)) {
    current = await mail(ctx, current, order, `invoice:${order.id}:${current.email_attempts}`)
  }
  return current
}

async function step(ctx: Context, orderId: string, manual: boolean): Promise<InvoiceRow | null> {
  let row = await ctx.invoices.findByOrder(orderId)
  if (!row) {
    if (!manual) return null
    row = await ctx.invoices.ensureForOrder(orderId)
  }
  const order = await pluginOptions(ctx.container).resolveOrder(ctx.container, orderId)
  if (!order) return row
  if (needsIssue(row, order, ctx.now, manual)) row = await issue(ctx, row, order, manual)
  else if (manual) throw new InvoiceActionError('Faktura do tego zamówienia jest już wystawiona.')
  return row.status === 'issued' ? afterIssue(ctx, row, order) : row
}

/** `order.placed`: the invoice row of a shop order with an e-mail (spec 6c §5.2). */
export async function ensureInvoiceRow(container: MedusaContainer, orderId: string): Promise<void> {
  if (!invoicingConfig(container)) {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: 'order',
      fields: ['display_id'],
      filters: { id: orderId },
    })
    const displayId = (data[0] as unknown as { display_id?: number } | undefined)?.display_id
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .info(
        `${logPrefix(container)} Fakturownia nie jest skonfigurowana – zamówienie ${displayId ? `#${displayId}` : orderId} bez faktury.`,
      )
    return
  }
  const order = await pluginOptions(container).resolveOrder(container, orderId)
  if (!order?.shopOrder || !order.email) return
  await moduleOf(container).ensureForOrder(orderId)
}

/**
 * Moves the order's invoice as far as it can go now: issue, KSeF, e-mail. `manual` – the admin
 * button: creates the row for an older order and refuses what cannot be done.
 */
export async function processInvoice(
  container: MedusaContainer,
  orderId: string,
  options: { now?: Date; manual?: boolean } = {},
): Promise<InvoiceRow | null> {
  const ctx = context(container, options.now ?? new Date())
  if (!ctx) {
    if (options.manual) throw new InvoiceActionError('Fakturownia nie jest skonfigurowana.')
    return null
  }
  const manual = options.manual ?? false
  try {
    return await locked(container, orderId, () => step(ctx, orderId, manual))
  } catch (error) {
    if (manual || !(error instanceof InvoiceBusyError)) throw error
    ctx.logger.info(busyLine(ctx.container, orderId))
    return null
  }
}

function requireContext(container: MedusaContainer, now: Date): Context {
  const ctx = context(container, now)
  if (!ctx) throw new InvoiceActionError('Fakturownia nie jest skonfigurowana.')
  return ctx
}

/** „Sprawdź ponownie”: re-reads a held invoice; a matching total lets it go on (spec 6c §5.3). */
export async function recheckInvoice(
  container: MedusaContainer,
  orderId: string,
  now = new Date(),
): Promise<InvoiceRow> {
  const ctx = requireContext(container, now)
  return locked(container, orderId, async () => {
    const row = await ctx.invoices.findByOrder(orderId)
    if (row?.status !== 'review' || !row.fakturownia_id) {
      throw new InvoiceActionError('Faktura nie czeka na sprawdzenie.')
    }
    const order = await pluginOptions(container).resolveOrder(container, orderId)
    if (!order) throw new InvoiceActionError('Nie znaleziono zamówienia.')
    let invoice: FakturowniaInvoice
    try {
      invoice = await ctx.client.getInvoice(row.fakturownia_id)
    } catch (error) {
      throw new InvoiceActionError(
        `Nie udało się odczytać faktury z Fakturowni: ${errorText(error)}`,
      )
    }
    const difference = invoice.totalCents - order.totalCents
    if (difference !== 0) {
      return save(ctx, row, { difference_cents: difference, number: invoice.number })
    }
    const issued = await save(ctx, row, {
      status: 'issued',
      difference_cents: null,
      number: invoice.number,
      alerted_for: null,
    })
    return afterIssue(ctx, issued, order)
  })
}

/** „Wyślij mail ponownie” – a ready invoice to the order's e-mail, with a fresh key. */
export async function resendInvoiceEmail(
  container: MedusaContainer,
  orderId: string,
  now = new Date(),
): Promise<InvoiceRow> {
  const ctx = requireContext(container, now)
  return locked(container, orderId, async () => {
    const row = await ctx.invoices.findByOrder(orderId)
    if (!row || !invoiceReady(row))
      throw new InvoiceActionError('Faktura nie jest gotowa do wysłania.')
    const order = await pluginOptions(container).resolveOrder(container, orderId)
    if (!order?.email) throw new InvoiceActionError('Zamówienie nie ma adresu e-mail.')
    try {
      const pdf = await ctx.client.downloadPdf(row.fakturownia_id as string)
      await sendInvoiceEmail(
        container,
        row,
        order,
        pdf,
        `invoice:${orderId}:manual:${now.getTime()}`,
      )
    } catch (error) {
      throw new InvoiceActionError(`Mail nie wyszedł: ${errorText(error)}`)
    }
    return save(ctx, row, { email_sent_at: now, email_error: null })
  })
}

/**
 * The PDF of a ready invoice; `null` without Fakturownia or before the invoice is ready.
 * Fakturownia failing the download is an `InvoicePdfUnavailableError`.
 */
export async function invoicePdf(
  container: MedusaContainer,
  orderId: string,
): Promise<{ filename: string; pdf: Buffer } | null> {
  const config = invoicingConfig(container)
  if (!config) return null
  const row = await moduleOf(container).findByOrder(orderId)
  if (!row || !invoiceReady(row) || !row.fakturownia_id || !row.number) return null
  try {
    return {
      filename: invoiceFilename(row.number),
      pdf: await clientFor(config).downloadPdf(row.fakturownia_id),
    }
  } catch (error) {
    if (!(error instanceof FakturowniaError)) throw error
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .warn(
        `${logPrefix(container)} PDF faktury ${row.number} nie przyszedł z Fakturowni: ${error.message}`,
      )
    throw new InvoicePdfUnavailableError()
  }
}

/** The job's pass (every 15 minutes): everything that can move on now (spec 6c §5.6). */
export async function sweepInvoices(
  container: MedusaContainer,
  now = new Date(),
): Promise<{ processed: number }> {
  const ctx = context(container, now)
  if (!ctx) return { processed: 0 }
  const list = (filters: Record<string, unknown>) =>
    ctx.invoices.listInvoices(filters, { select: ['order_id'], take: null })
  const changedSince = (ms: number) => ({ updated_at: { $gte: new Date(now.getTime() - ms) } })
  const groups = await Promise.all([
    list({ status: 'waiting' }),
    list({ status: 'failed', error_kind: 'transient', next_attempt_at: { $lte: dueBy(now) } }),
    list({ status: 'issuing', updated_at: { $lt: new Date(now.getTime() - STALE_ISSUING_MS) } }),
    list({
      status: 'issued',
      ksef: ['pending', 'sent', 'error'],
      ...changedSince(REREAD_ISSUED_MS),
    }),
    list({ status: 'issued', email_sent_at: null, ...changedSince(REREAD_ISSUED_MS) }),
    list({ status: 'skipped', skip_reason: 'unpaid', ...changedSince(REVIVE_UNPAID_MS) }),
  ])
  const orderIds = [...new Set(groups.flat().map((row) => row.order_id))]
  let processed = 0
  for (const orderId of orderIds) {
    try {
      await locked(container, orderId, () => step(ctx, orderId, false))
      processed++
    } catch (error) {
      if (error instanceof InvoiceBusyError) {
        ctx.logger.info(busyLine(ctx.container, orderId))
        continue
      }
      ctx.logger.warn(
        `${logPrefix(ctx.container)} Przegląd faktury do zamówienia ${orderId}: ${errorText(error)}`,
      )
    }
  }
  return { processed }
}

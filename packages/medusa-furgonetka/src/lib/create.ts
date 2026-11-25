import { randomUUID } from 'node:crypto'
import type { Logger, MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import { createOrderFulfillmentWorkflow } from '@medusajs/medusa/core-flows'
import { FURGONETKA_MODULE } from '../modules/furgonetka'
import type FurgonetkaModuleService from '../modules/furgonetka/service'
import type { ShipmentRow, TemplateRow } from '../modules/furgonetka/service'
import { type Carrier, NOT_CANCELED_MESSAGE } from '../types'
import { FurgonetkaError } from './api-errors'
import type { PickupChoice } from './card-types'
import { CARRIER_NAMES, httpUrl, trackingUrl } from './carriers'
import type {
  FurgonetkaClient,
  FurgonetkaService,
  OrderResult,
  PackageInfo,
  PickupResult,
  Sender,
} from './client'
import { type FurgonetkaConfig, furgonetkaConfig } from './config'
import { clientFor } from './connect'
import { prefixedLogger } from './log'
import { loadShippingOrder } from './order'
import { defaultPickup, type PickupWindow } from './pickup'
import {
  keptPackage,
  orderBlocker,
  PAGE_BLOCKERS,
  planProblems,
  planSettings,
  type ShipmentPlan,
  shipmentPlan,
} from './plan'
import type { CreateResult } from './queue-types'
import { asJson } from './rows'
import { loadSender } from './sender'
import { connectionState } from './tokens'

// These types and texts are shared with the panel, so they live where the admin can import them.
export type { CreateResult, PickupChoice }
export { NOT_CANCELED_MESSAGE }

/** A shipment request that cannot be done now – the message goes to the panel (HTTP 400). */
export class ShipmentActionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ShipmentActionError'
  }
}

export const BUSY_MESSAGE = 'Przesyłka jest właśnie tworzona – odśwież stronę za chwilę.'
export const PROCESSING_MESSAGE =
  'Furgonetka jeszcze przetwarza zamówienie – stan uzupełni się w ciągu kilku minut'
export const NO_ORDER_MESSAGE = 'Nie ma takiego zamówienia.'
const NOT_ORDERED_MESSAGE = 'Furgonetka nie zamówiła paczki – spróbuj ponownie.'
const PACKAGE_CANCELED_MESSAGE = 'Paczka jest anulowana w Furgonetce – utwórz przesyłkę ponownie.'
const NO_PICKUP_MESSAGE = 'Furgonetka nie zamówiła odbioru.'
const CHECK_PICKUP = 'sprawdź w Furgonetce, zanim ponowisz odbiór'
export const NO_SHIPMENT_MESSAGE = 'Nie ma takiej przesyłki.'
const NOT_WAITING_MESSAGE = 'Ta przesyłka nie czeka na zamówienie odbioru.'
const PICKUP_UNAVAILABLE_MESSAGE = 'Furgonetka nie pozwala zamówić odbioru tej przesyłki.'

export const fulfillmentFailedMessage = (detail: string) =>
  `Nie udało się utworzyć realizacji w Medusie: ${detail}`

const LOCK_TIMEOUT_S = 120
/** How both locking providers (in-memory, Redis) end a wait that ran out. */
const LOCK_TIMED_OUT = 'Timed-out acquiring lock.'
/** A `creating` row changed within this time belongs to a pass that is still running. */
const FRESH_MS = 10 * 60_000

/** Workflow and module errors may come as plain objects with `message`. */
export const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : String((error as { message?: unknown } | null)?.message ?? error)

/** A message without its final full stop, to go on with a dash or a sentence. */
const clause = (text: string) => text.trim().replace(/\.+$/, '')

// ---------------------------------------------------------------------------------------------
// Rules (pure)
// ---------------------------------------------------------------------------------------------

/** The API keys of the carriers in `/account/services`. */
const SERVICE_KEYS: Record<Carrier, string> = {
  dpd: 'dpd',
  inpost_courier: 'inpostkurier',
  inpost_locker: 'inpost',
}

/** The service of the carrier on the account; the shop's own contract before Furgonetka's. */
export function serviceFor(services: FurgonetkaService[], carrier: Carrier): number | null {
  const offered = services.filter((service) => service.service === SERVICE_KEYS[carrier])
  return (offered.find((service) => service.owner === 'client') ?? offered[0])?.id ?? null
}

export const noServiceMessage = (carrier: Carrier) =>
  `Brak usługi ${CARRIER_NAMES[carrier]} na koncie Furgonetki`

/**
 * What to do with the package an earlier attempt left in Furgonetka: `ordered` – it is paid, go on
 * with it; `replace` – never ordered (free), delete it and make one from the current plan;
 * `create` – there is none (or it was cancelled); `pending` – an order of it is under way.
 */
export type PackageStep = 'create' | 'replace' | 'ordered' | 'pending'

export function packageStep(info: PackageInfo | null): PackageStep {
  if (!info || info.state === 'cancelled' || info.state === 'canceled') return 'create'
  if (info.state === 'ordered') return 'ordered'
  if (info.state === 'waiting') return 'replace'
  return 'pending'
}

/**
 * The row message for an order command that threw. The client throws when nothing was ordered
 * (no funds, the carrier terms, a refusal); a timeout or anything unexpected leaves the outcome
 * unknown – `null`, the rows stay `creating` and the order is polled again later.
 */
export function commandFailure(error: unknown): string | null {
  if (error instanceof FurgonetkaError && error.kind !== 'transient') return error.message
  return null
}

/** The errors a finished order command names for this package; `null` when it was ordered. */
export function ownError(result: OrderResult, packageId: string): string | null {
  if (result.ordered.includes(packageId)) return null
  const own = result.errors.filter((error) => error.packageId === packageId)
  return own.length ? own.map((error) => error.message).join('; ') : null
}

/** Why a finished order command did not order this package. */
export function notOrderedMessage(result: OrderResult, packageId: string): string {
  const general = result.errors
    .filter((error) => error.packageId === null)
    .map((error) => error.message)
    .join('; ')
  return ownError(result, packageId) ?? (general || NOT_ORDERED_MESSAGE)
}

/**
 * Why a finished order command did not order this package; `null` – it goes on to its fulfillment
 * (phase C). A package the command names was refused. One left out of a command that did not
 * fully succeed was not ordered (nor paid) either – the balance ran out before it, say – and gets
 * the command's reason. A `successful` command that does not list a package is not taken at its
 * word: phase C reads the package again.
 */
export function unorderedReason(result: OrderResult, packageId: string): string | null {
  if (result.ordered.includes(packageId)) return null
  const own = ownError(result, packageId)
  if (own) return own
  return result.status === 'successful' ? null : notOrderedMessage(result, packageId)
}

/** The row message for a pickup that threw; after a timeout nobody knows whether it was booked. */
export function pickupFailure(error: unknown): string {
  if (error instanceof FurgonetkaError && error.kind !== 'transient') return error.message
  return `${clause(errorText(error))} – ${CHECK_PICKUP}`
}

export function isFresh(row: Pick<ShipmentRow, 'updated_at'>, now: Date): boolean {
  return now.getTime() - new Date(row.updated_at).getTime() < FRESH_MS
}

/** The parcel numbers of an ordered package, each with an `http(s)` tracking link. */
export function trackingFrom(
  carrier: Carrier,
  info: PackageInfo,
): { number: string; url: string }[] {
  return info.tracking.map(({ number, url }) => ({
    number,
    url: httpUrl(url) ?? trackingUrl(carrier, number),
  }))
}

/** The labels of the Medusa fulfillment: the numbers and the label route of the panel. */
export function fulfillmentLabels(rowId: string, tracking: { number: string; url: string }[]) {
  return tracking.map((entry) => ({
    tracking_number: entry.number,
    tracking_url: entry.url,
    label_url: `/admin/shipments/${rowId}/label`,
  }))
}

// ---------------------------------------------------------------------------------------------
// Context and lock
// ---------------------------------------------------------------------------------------------

interface Context {
  container: MedusaContainer
  config: FurgonetkaConfig
  client: FurgonetkaClient
  shipments: FurgonetkaModuleService
  logger: Logger
  now: Date
}

type RowChange = Partial<
  Omit<ShipmentRow, 'id' | 'order_id' | 'created_at' | 'updated_at' | 'deleted_at'>
>

const moduleOf = (container: MedusaContainer) =>
  container.resolve<FurgonetkaModuleService>(FURGONETKA_MODULE)

/** Every change of a shipment row runs under the order's lock (spec 6d §5.6). */
export async function lockShipment<T>(
  container: MedusaContainer,
  orderId: string,
  job: () => Promise<T>,
): Promise<T> {
  try {
    return await container
      .resolve(Modules.LOCKING)
      .execute(`shipment:${orderId}`, job, { timeout: LOCK_TIMEOUT_S })
  } catch (error) {
    // Another pass kept the lock for the whole wait – it is working on this shipment.
    if (errorText(error) === LOCK_TIMED_OUT) throw new ShipmentActionError(BUSY_MESSAGE)
    throw error
  }
}

/** The configured and connected account, or why the shop cannot use it (spec 6d §5.4). */
async function setup(
  container: MedusaContainer,
  now: Date,
): Promise<{ ctx: Context } | { blocked: string }> {
  const config = furgonetkaConfig(process.env)
  if (!config) return { blocked: PAGE_BLOCKERS.not_configured }
  const { state } = await connectionState(container, config)
  if (state !== 'connected') return { blocked: PAGE_BLOCKERS[state] }
  return {
    ctx: {
      container,
      config,
      client: clientFor(container, config),
      shipments: moduleOf(container),
      logger: prefixedLogger(container),
      now,
    },
  }
}

async function save(ctx: Context, rowId: string, change: RowChange): Promise<ShipmentRow> {
  return (await ctx.shipments.updateShipments({ id: rowId, ...change })) as ShipmentRow
}

const failure = (
  orderId: string,
  shipmentId: string | null,
  message: string | null,
): CreateResult => ({ orderId, shipmentId, ok: false, message })

function once<T>(load: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | null = null
  return () => {
    promise ??= load()
    return promise
  }
}

// ---------------------------------------------------------------------------------------------
// Phase A – the package of each order, under its lock
// ---------------------------------------------------------------------------------------------

interface Batch {
  ctx: Context
  sender: Sender
  pickup: PickupChoice
  templates: TemplateRow[]
  /** `/account/services`, read once per batch. */
  services: () => Promise<FurgonetkaService[]>
}

/** An order of the batch whose package is in Furgonetka; `ordered` – paid already, no command. */
interface Prepared {
  index: number
  orderId: string
  rowId: string
  packageId: string
  ordered: boolean
}

type PackageRef = Pick<Prepared, 'packageId' | 'ordered'>

async function packageOrNull(
  client: FurgonetkaClient,
  packageId: string,
): Promise<PackageInfo | null> {
  try {
    return await client.getPackage(packageId)
  } catch (error) {
    if (error instanceof FurgonetkaError && error.kind === 'not_found') return null
    throw error
  }
}

/**
 * The package of a `creating` row; `before` is the row as this pass found it. One left by an
 * earlier attempt is checked first: by its id, or by the reference when the attempt died before
 * the id was saved. `null` – an order of the package is under way, or Furgonetka cannot say now
 * what became of the package of an interrupted run; the row waits.
 */
async function ensurePackage(
  batch: Batch,
  row: ShipmentRow,
  plan: ShipmentPlan,
  before: ShipmentRow | null,
): Promise<PackageRef | null> {
  const { ctx } = batch
  const reference = row.reference as string
  let found: PackageInfo | null = null
  if (row.package_id) {
    try {
      found = await packageOrNull(ctx.client, row.package_id)
    } catch (error) {
      // An interrupted run (a row left `creating`) may have its package ordered – paid – already,
      // and its plan is the one that package was made from: not knowing is no failure, the row
      // stays `creating` for the job to resume. A draft or a failed row may carry a new plan, so it
      // fails as before and the next try reads the package again.
      const unknown = error instanceof FurgonetkaError && error.kind === 'transient'
      if (!unknown || before?.state !== 'creating') throw error
      ctx.logger.warn(`Stan paczki ${row.package_id} nieznany: ${errorText(error)}`)
      return null
    }
  } else if (before?.reference) {
    found = await ctx.client.findPackage(reference)
    if (found) await save(ctx, row.id, { package_id: found.packageId })
  }

  const step = packageStep(found)
  if (found && step === 'ordered') return { packageId: found.packageId, ordered: true }
  if (step === 'pending') return null
  if (found && step === 'replace') await ctx.client.deletePackage(found.packageId)
  if (found || row.package_id) {
    // Forgotten before the new package exists: a crash now leaves a row that searches by reference.
    await save(ctx, row.id, {
      package_id: null,
      order_command_id: null,
      tracking: null,
      cost_cents: null,
    })
  }

  const serviceId = serviceFor(await batch.services(), plan.carrier)
  if (serviceId === null) throw new Error(noServiceMessage(plan.carrier))
  const { packageId } = await ctx.client.createPackage({
    reference,
    serviceId,
    carrier: plan.carrier,
    receiver: plan.receiver,
    sender: batch.sender,
    parcels: plan.parcels,
    declaredValueCents: plan.declaredValueCents,
    pickup: batch.pickup.type,
  })
  await save(ctx, row.id, { package_id: packageId })
  return { packageId, ordered: false }
}

async function prepareLocked(
  batch: Batch,
  orderId: string,
): Promise<{ result: CreateResult; package?: Omit<Prepared, 'index' | 'orderId'> }> {
  const { ctx } = batch
  const order = await loadShippingOrder(ctx.container, orderId)
  if (!order) return { result: failure(orderId, null, NO_ORDER_MESSAGE) }
  const current = await ctx.shipments.activeShipment(orderId)
  const shipmentId = current?.id ?? null
  const blocker = orderBlocker(order, current)
  if (blocker) return { result: failure(orderId, shipmentId, blocker) }
  // The package of the order's canceled shipment is still in Furgonetka: no second one.
  const kept = current ? null : keptPackage(await ctx.shipments.latestShipment(orderId))
  if (kept) return { result: failure(orderId, kept.id, NOT_CANCELED_MESSAGE) }
  if (current?.state === 'creating' && isFresh(current, ctx.now)) {
    return { result: failure(orderId, shipmentId, BUSY_MESSAGE) }
  }
  const settings = planSettings(ctx.container)
  const plan = shipmentPlan(order, current, batch.templates, settings)
  const problems = planProblems(order, plan, settings)
  if ('missing' in plan || problems.length) {
    return {
      result: failure(orderId, shipmentId, problems.map((problem) => problem.message).join(' ')),
    }
  }

  // The row is `creating` before Furgonetka hears of it, so an interrupted run can be found.
  const window = batch.pickup.type === 'courier' ? batch.pickup : null
  const values = {
    state: 'creating' as const,
    carrier: plan.carrier,
    receiver: asJson(plan.receiver),
    parcels: asJson(plan.parcels),
    declared_value_cents: plan.declaredValueCents,
    // The batch decides how the parcels leave (spec 6d §5.5); the courier window is the one asked
    // for until a booking trims it.
    pickup: batch.pickup.type,
    pickup_status: 'none' as const,
    pickup_id: null,
    pickup_date: window?.date ?? null,
    pickup_from: window?.from ?? null,
    pickup_to: window?.to ?? null,
    reference: `CHNS-${order.displayId}`,
    last_error: null,
  }
  // A row an earlier attempt took to Furgonetka (it has a reference) may have left a package there.
  const row = current
    ? await save(ctx, current.id, values)
    : ((await ctx.shipments.createShipments({ order_id: orderId, ...values })) as ShipmentRow)

  try {
    const found = await ensurePackage(batch, row, plan, current)
    if (!found) return { result: failure(orderId, row.id, PROCESSING_MESSAGE) }
    return { result: failure(orderId, row.id, null), package: { rowId: row.id, ...found } }
  } catch (error) {
    const message = errorText(error)
    ctx.logger.warn(`Przesyłka do zamówienia #${order.displayId} nie powstała: ${message}`)
    await save(ctx, row.id, { state: 'failed', last_error: message })
    return { result: failure(orderId, row.id, message) }
  }
}

async function prepare(
  batch: Batch,
  orderId: string,
): Promise<{ result: CreateResult; package?: Omit<Prepared, 'index' | 'orderId'> }> {
  try {
    return await lockShipment(batch.ctx.container, orderId, () => prepareLocked(batch, orderId))
  } catch (error) {
    batch.ctx.logger.warn(`Przesyłka do zamówienia ${orderId} nie powstała: ${errorText(error)}`)
    return { result: failure(orderId, null, errorText(error)) }
  }
}

// ---------------------------------------------------------------------------------------------
// Phase B – one order command for the batch, outside the locks
// ---------------------------------------------------------------------------------------------

/** A row Furgonetka refused: `failed` with the message, if it is still the row that was sent. */
async function failRow(
  ctx: Context,
  item: Pick<Prepared, 'orderId' | 'rowId' | 'packageId'>,
  message: string,
): Promise<CreateResult> {
  ctx.logger.warn(`Przesyłka ${item.rowId} nie powstała: ${message}`)
  try {
    await lockShipment(ctx.container, item.orderId, async () => {
      const row = await ctx.shipments.retrieveShipment(item.rowId)
      if (row.state === 'creating' && row.package_id === item.packageId) {
        await save(ctx, row.id, { state: 'failed', last_error: message })
      }
    })
  } catch (error) {
    ctx.logger.error(`Błąd przesyłki ${item.rowId} nie został zapisany: ${errorText(error)}`)
  }
  return failure(item.orderId, item.rowId, message)
}

/** Orders (and pays for) the new packages; the ones to finish come back. */
async function orderBatch(
  batch: Batch,
  items: Prepared[],
  results: CreateResult[],
): Promise<Prepared[]> {
  const { ctx } = batch
  const commandId = randomUUID()
  const sent: Prepared[] = []
  for (const item of items) {
    try {
      const marked = await lockShipment(ctx.container, item.orderId, async () => {
        const row = await ctx.shipments.retrieveShipment(item.rowId)
        if (row.state !== 'creating' || row.package_id !== item.packageId) return false
        // Saved before the command goes out: a lost answer is polled again under the same id
        // instead of ordering (and paying) twice.
        await save(ctx, row.id, { order_command_id: commandId })
        return true
      })
      if (marked) sent.push(item)
      else results[item.index] = failure(item.orderId, item.rowId, BUSY_MESSAGE)
    } catch (error) {
      results[item.index] = failure(item.orderId, item.rowId, errorText(error))
    }
  }
  if (!sent.length) return []

  let outcome: OrderResult
  try {
    outcome = await ctx.client.orderPackages(
      commandId,
      sent.map((item) => item.packageId),
    )
  } catch (error) {
    const message = commandFailure(error)
    if (message === null) {
      ctx.logger.warn(
        `Zamówienie przesyłek ${commandId} bez wyniku – dokończy je zadanie: ${errorText(error)}`,
      )
      for (const item of sent) {
        results[item.index] = failure(item.orderId, item.rowId, PROCESSING_MESSAGE)
      }
      return []
    }
    for (const item of sent) results[item.index] = await failRow(ctx, item, message)
    return []
  }

  // A partly successful command (the balance ran out part way) paid for some packages: those go on.
  const next: Prepared[] = []
  for (const item of sent) {
    const reason = unorderedReason(outcome, item.packageId)
    if (reason) results[item.index] = await failRow(ctx, item, reason)
    else next.push(item)
  }
  return next
}

// ---------------------------------------------------------------------------------------------
// Phase C – the Medusa fulfillment of each ordered package, under its lock
// ---------------------------------------------------------------------------------------------

/** The fulfillment this row already made – a run that died before saving its id. */
async function ownFulfillment(
  container: MedusaContainer,
  orderId: string,
  rowId: string,
): Promise<string | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: 'order',
    fields: ['fulfillments.id', 'fulfillments.canceled_at', 'fulfillments.metadata'],
    filters: { id: orderId },
  })
  const fulfillments = (data[0]?.fulfillments ?? []) as unknown as ({
    id: string
    canceled_at: unknown
    metadata: Record<string, unknown> | null
  } | null)[]
  const own = fulfillments.find(
    (fulfillment) =>
      fulfillment &&
      !fulfillment.canceled_at &&
      fulfillment.metadata?.furgonetka_shipment_id === rowId,
  )
  return own?.id ?? null
}

/** All items of the order go out, through the manual provider (spec 6d §5.6 step 5). */
async function fulfil(
  container: MedusaContainer,
  row: ShipmentRow,
  tracking: { number: string; url: string }[],
): Promise<string> {
  const order = await loadShippingOrder(container, row.order_id)
  if (!order) throw new Error(NO_ORDER_MESSAGE)
  const { result } = await createOrderFulfillmentWorkflow(container).run({
    input: {
      order_id: row.order_id,
      items: order.items.map((item) => ({ id: item.id, quantity: item.quantity })),
      labels: fulfillmentLabels(row.id, tracking),
      no_notification: true,
      metadata: { furgonetka_shipment_id: row.id },
    },
  })
  return result.id
}

/** Cancels a package; `false` – Furgonetka refused or could not be reached (logged, never thrown). */
export async function cancelPackageQuietly(
  client: FurgonetkaClient,
  logger: Logger,
  packageId: string,
): Promise<boolean> {
  try {
    const [result] = await client.cancelPackages([packageId])
    return Boolean(result?.ok)
  } catch (error) {
    logger.error(`Paczka ${packageId} nie została anulowana w Furgonetce: ${errorText(error)}`)
    return false
  }
}

/** `made` – this pass made the row ready, so the pickup of the row is this pass's to book. */
type Finish = { ok: boolean; message: string | null; made: boolean }

/** Phase C for one row, with its lock held. `known` – the package as just read. */
async function finishLocked(ctx: Context, rowId: string, known?: PackageInfo): Promise<Finish> {
  const row = await ctx.shipments.retrieveShipment(rowId)
  // Finished by another pass, which books its pickup too.
  if (row.state === 'ready') return { ok: true, message: null, made: false }
  if (row.state !== 'creating' || !row.package_id) {
    return { ok: false, message: row.last_error ?? BUSY_MESSAGE, made: false }
  }

  let info: PackageInfo
  try {
    info = known ?? (await ctx.client.getPackage(row.package_id))
  } catch (error) {
    ctx.logger.warn(`Stan paczki ${row.package_id} nieznany: ${errorText(error)}`)
    return { ok: false, message: PROCESSING_MESSAGE, made: false }
  }
  // Not ordered yet, or without numbers: the row stays `creating` and is finished later.
  if (info.state !== 'ordered' || !info.tracking.length) {
    return { ok: false, message: PROCESSING_MESSAGE, made: false }
  }

  const tracking = trackingFrom(row.carrier, info)
  await save(ctx, row.id, { tracking: asJson(tracking), cost_cents: info.costCents })
  let fulfillmentId = await ownFulfillment(ctx.container, row.order_id, row.id)
  if (!fulfillmentId) {
    try {
      fulfillmentId = await fulfil(ctx.container, row, tracking)
    } catch (error) {
      const message = fulfillmentFailedMessage(errorText(error))
      const canceled = await cancelPackageQuietly(ctx.client, ctx.logger, row.package_id)
      const lastError = canceled ? message : `${clause(message)}. ${NOT_CANCELED_MESSAGE}`
      ctx.logger.error(`Przesyłka ${row.id}: ${lastError}`)
      await save(ctx, row.id, { state: 'failed', last_error: lastError })
      return { ok: false, message: lastError, made: false }
    }
  }
  await save(ctx, row.id, {
    state: 'ready',
    fulfillment_id: fulfillmentId,
    pickup_status: 'none',
    last_error: null,
  })
  return { ok: true, message: null, made: true }
}

async function finish(ctx: Context, orderId: string, rowId: string): Promise<Finish> {
  try {
    return await lockShipment(ctx.container, orderId, () => finishLocked(ctx, rowId))
  } catch (error) {
    return { ok: false, message: errorText(error), made: false }
  }
}

// ---------------------------------------------------------------------------------------------
// Phase D – the courier pickup
// ---------------------------------------------------------------------------------------------

type Booking = PickupResult['ordered'][number]

interface PickupTarget {
  orderId: string
  rowId: string
  packageId: string
}

/** One pickup request for the packages: the booking of each, or why there is none. */
async function askPickup(
  ctx: Context,
  packageIds: string[],
  window: PickupWindow,
): Promise<Map<string, { booked: Booking | null; problem: string | null }>> {
  let outcome: PickupResult | null = null
  let thrown: string | null = null
  try {
    outcome = await ctx.client.orderPickup(packageIds, window)
  } catch (error) {
    thrown = pickupFailure(error)
    ctx.logger.warn(`Odbiór przesyłek niezamówiony: ${thrown}`)
  }
  const answers = new Map<string, { booked: Booking | null; problem: string | null }>()
  for (const packageId of packageIds) {
    const booked = outcome?.ordered.find((entry) => entry.packageId === packageId) ?? null
    const problem = booked
      ? null
      : (thrown ??
        outcome?.failed.find((entry) => entry.packageId === packageId)?.message ??
        NO_PICKUP_MESSAGE)
    answers.set(packageId, { booked, problem })
  }
  return answers
}

/** Writes the pickup outcome to a ready row, with its lock held. A booking is never undone. */
async function savePickup(
  ctx: Context,
  rowId: string,
  window: PickupWindow,
  answer: { booked: Booking | null; problem: string | null },
): Promise<void> {
  const row = await ctx.shipments.retrieveShipment(rowId)
  if (row.state !== 'ready') return
  if (answer.booked) {
    await save(ctx, row.id, {
      pickup: 'courier',
      pickup_status: 'ordered',
      pickup_id: answer.booked.pickupId,
      pickup_date: window.date,
      pickup_from: answer.booked.from,
      pickup_to: answer.booked.to,
      last_error: null,
    })
  } else if (row.pickup === 'courier' && row.pickup_status !== 'ordered') {
    // A drop-off shipment that could not get a courier simply stays a drop-off.
    await save(ctx, row.id, { pickup_status: 'failed', last_error: answer.problem })
  }
}

/** Phase D for the batch: one request, each row written under its lock; the problem per row. */
async function bookPickups(
  ctx: Context,
  targets: PickupTarget[],
  window: PickupWindow,
): Promise<Map<string, string | null>> {
  const answers = await askPickup(
    ctx,
    targets.map((target) => target.packageId),
    window,
  )
  const problems = new Map<string, string | null>()
  for (const target of targets) {
    const answer = answers.get(target.packageId) ?? { booked: null, problem: NO_PICKUP_MESSAGE }
    try {
      await lockShipment(ctx.container, target.orderId, () =>
        savePickup(ctx, target.rowId, window, answer),
      )
    } catch (error) {
      ctx.logger.error(`Odbiór przesyłki ${target.rowId} nie został zapisany: ${errorText(error)}`)
    }
    problems.set(target.rowId, answer.problem)
  }
  return problems
}

// ---------------------------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------------------------

/**
 * Creates the shipments of a batch of orders (spec 6d §5.6) in four phases: the package of each
 * order (A), one order command for all of them (B), the Medusa fulfillment of each ordered package
 * (C) and one courier pickup (D). Every change of a row runs under the order's lock, the command
 * and the pickup run outside it. One order's error does not stop the others.
 */
export async function createShipments(
  container: MedusaContainer,
  orderIds: string[],
  pickup: PickupChoice,
  options: { now?: Date } = {},
): Promise<CreateResult[]> {
  const ids = [...new Set(orderIds)]
  const ready = await setup(container, options.now ?? new Date())
  if ('blocked' in ready) return ids.map((orderId) => failure(orderId, null, ready.blocked))
  const { ctx } = ready
  const sender = await loadSender(container)
  if (!sender) return ids.map((orderId) => failure(orderId, null, PAGE_BLOCKERS.sender))

  const batch: Batch = {
    ctx,
    sender,
    pickup,
    templates: (await ctx.shipments.listParcelTemplates()) as TemplateRow[],
    services: once(() => ctx.client.services()),
  }
  const results = ids.map((orderId) => failure(orderId, null, null))

  const prepared: Prepared[] = []
  for (const [index, orderId] of ids.entries()) {
    const step = await prepare(batch, orderId)
    results[index] = step.result
    if (step.package) prepared.push({ index, orderId, ...step.package })
  }

  const toOrder = prepared.filter((item) => !item.ordered)
  const toFinish = [
    ...prepared.filter((item) => item.ordered),
    ...(toOrder.length ? await orderBatch(batch, toOrder, results) : []),
  ].sort((a, b) => a.index - b.index)

  const finished: Prepared[] = []
  for (const item of toFinish) {
    const { made, ...outcome } = await finish(ctx, item.orderId, item.rowId)
    results[item.index] = { orderId: item.orderId, shipmentId: item.rowId, ...outcome }
    if (made) finished.push(item)
  }

  if (pickup.type === 'courier' && finished.length) {
    const window = { date: pickup.date, from: pickup.from, to: pickup.to }
    const problems = await bookPickups(ctx, finished, window)
    for (const item of finished) {
      const result = results[item.index] as CreateResult
      results[item.index] = { ...result, message: problems.get(item.rowId) ?? null }
    }
  }
  return results
}

/** The window asked for when the row was created, unless it has passed – then the default one. */
function resumeWindow(row: ShipmentRow, now: Date, config: FurgonetkaConfig): PickupWindow {
  const fallback = defaultPickup(now, config)
  const { pickup_date: date, pickup_from: from, pickup_to: to } = row
  if (!date || !from || !to || date < fallback.date) return fallback
  if (date > fallback.date) return { date, from, to }
  const start = from > fallback.from ? from : fallback.from
  return start < to ? { date, from: start, to } : fallback
}

/**
 * Finishes a `creating` row whose order command went out (phases C and D) – the job does this for
 * a run that lost the answer. A package that is not ordered yet is polled again under the same
 * command id, so nothing is ordered twice. Errors that may pass leave the row for the next run.
 */
export async function resumeShipment(
  container: MedusaContainer,
  row: ShipmentRow,
  now: Date = new Date(),
): Promise<void> {
  const ready = await setup(container, now)
  if ('blocked' in ready) return
  const { ctx } = ready
  await lockShipment(container, row.order_id, async () => {
    const current = await ctx.shipments.retrieveShipment(row.id)
    const packageId = current.package_id
    const commandId = current.order_command_id
    if (current.state !== 'creating' || !packageId || !commandId) return

    let info: PackageInfo | undefined
    try {
      info = await ctx.client.getPackage(packageId)
    } catch (error) {
      if (error instanceof FurgonetkaError && error.kind === 'not_found') {
        await save(ctx, current.id, { state: 'failed', last_error: error.message })
        return
      }
      ctx.logger.warn(`Przesyłka ${current.id} czeka dalej: ${errorText(error)}`)
      return
    }
    // Cancelled in Furgonetka meanwhile: polling the command again would never finish the row.
    if (packageStep(info) === 'create') {
      await save(ctx, current.id, { state: 'failed', last_error: PACKAGE_CANCELED_MESSAGE })
      return
    }
    if (info.state !== 'ordered') {
      let result: OrderResult
      try {
        result = await ctx.client.orderPackages(commandId, [packageId])
      } catch (error) {
        const message = commandFailure(error)
        if (message === null) {
          ctx.logger.warn(`Przesyłka ${current.id} czeka dalej: ${errorText(error)}`)
        } else {
          await save(ctx, current.id, { state: 'failed', last_error: message })
        }
        return
      }
      if (!result.ordered.includes(packageId)) {
        await save(ctx, current.id, {
          state: 'failed',
          last_error: notOrderedMessage(result, packageId),
        })
        return
      }
      info = undefined
    }

    const outcome = await finishLocked(ctx, current.id, info)
    if (!outcome.ok || current.pickup !== 'courier') return
    const window = resumeWindow(current, now, ctx.config)
    const answer = (await askPickup(ctx, [packageId], window)).get(packageId)
    if (answer) await savePickup(ctx, current.id, window, answer)
  })
}

/** Why a shipment cannot get a courier pickup now; `null` – it can. */
async function pickupBlocker(ctx: Context, row: ShipmentRow): Promise<string | null> {
  if (row.state !== 'ready' || !row.package_id || row.pickup_status === 'ordered') {
    return NOT_WAITING_MESSAGE
  }
  if (row.pickup === 'courier') return row.pickup_status === 'failed' ? null : NOT_WAITING_MESSAGE
  try {
    const info = await ctx.client.getPackage(row.package_id)
    return info.pickupAvailable ? null : PICKUP_UNAVAILABLE_MESSAGE
  } catch (error) {
    return errorText(error)
  }
}

/**
 * „Zamów odbiór” (spec 6d §5.4): phase D again for ready shipments whose pickup failed, and for
 * drop-off ones Furgonetka lets a courier collect. `ok` – the pickup is booked.
 */
export async function retryPickups(
  container: MedusaContainer,
  shipmentIds: string[],
  window: PickupWindow,
  now: Date = new Date(),
): Promise<CreateResult[]> {
  const ids = [...new Set(shipmentIds)]
  const rows = ids.length
    ? ((await moduleOf(container).listShipments({ id: ids })) as ShipmentRow[])
    : []
  const rowOf = (id: string) => rows.find((row) => row.id === id) ?? null
  const ready = await setup(container, now)
  if ('blocked' in ready) {
    return ids.map((id) => failure(rowOf(id)?.order_id ?? '', id, ready.blocked))
  }
  const { ctx } = ready

  const results: CreateResult[] = []
  const targets: (PickupTarget & { index: number })[] = []
  for (const [index, id] of ids.entries()) {
    const row = rowOf(id)
    if (!row) {
      results.push(failure('', id, NO_SHIPMENT_MESSAGE))
      continue
    }
    const reason = await pickupBlocker(ctx, row)
    results.push(failure(row.order_id, row.id, reason))
    if (!reason && row.package_id) {
      targets.push({ index, orderId: row.order_id, rowId: row.id, packageId: row.package_id })
    }
  }
  if (targets.length) {
    const problems = await bookPickups(ctx, targets, window)
    for (const target of targets) {
      const problem = problems.get(target.rowId) ?? null
      results[target.index] = {
        orderId: target.orderId,
        shipmentId: target.rowId,
        ok: problem === null,
        message: problem,
      }
    }
  }
  return results
}

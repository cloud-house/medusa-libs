import type { Logger, MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import {
  createOrderShipmentWorkflow,
  markOrderFulfillmentAsDeliveredWorkflow,
} from '@medusajs/medusa/core-flows'
import { FURGONETKA_MODULE } from '../modules/furgonetka'
import type FurgonetkaModuleService from '../modules/furgonetka/service'
import type { ShipmentRow } from '../modules/furgonetka/service'
import type { HistoryEntry } from '../types'
import { sendShipmentAlert } from './alerts'
import { httpUrl, trackingUrl } from './carriers'
import type { TrackingEvent } from './client'
import { furgonetkaConfig } from './config'
import { clientFor } from './connect'
import { fulfillmentLabels, lockShipment, resumeShipment, ShipmentActionError } from './create'
import { prefixedLogger as loggerOf } from './log'
import { asJson, historyOf, trackingOf } from './rows'
import { accessToken, connectionState } from './tokens'

// ---------------------------------------------------------------------------------------------
// Rules (pure)
// ---------------------------------------------------------------------------------------------

/** What a carrier status means for the shop (spec 6d §5.7); `other` only goes to the history. */
export type TrackingEffect = 'picked_up' | 'delivered' | 'problem' | 'other'

/**
 * Furgonetka's tracking states that change the shipment. `waiting`, `ordered`, `collect-problem`,
 * `ready-for-transport`, `canceled` and unknown states are `other` – whether `ready-for-transport`
 * comes before the pickup is to be checked live (spec 6d §9).
 */
const EFFECTS = new Map<string, TrackingEffect>([
  // The carrier has the package.
  ['collected', 'picked_up'],
  ['transit', 'picked_up'],
  ['delivery', 'picked_up'],
  ['delivery-problem', 'picked_up'],
  ['waiting-for-receiver', 'picked_up'],
  // Also a parcel picked up from the parcel locker.
  ['delivered', 'delivered'],
  // A lost or damaged parcel comes as `unexpected-situation`.
  ['returned', 'problem'],
  ['unexpected-situation', 'problem'],
])

export function trackingEffect(state: string): TrackingEffect {
  return EFFECTS.get(state) ?? 'other'
}

/** The states the carrier's statuses move a shipment through; it never goes back down. */
export const STATE_RANK = { ready: 0, in_transit: 1, problem: 2, delivered: 3 } as const

export type TrackedState = keyof typeof STATE_RANK

const EFFECT_STATE: Record<TrackingEffect, TrackedState | null> = {
  picked_up: 'in_transit',
  delivered: 'delivered',
  problem: 'problem',
  other: null,
}

const TRACKED_STATES = new Set<string>(Object.keys(STATE_RANK))

/** A shipment whose package is with Furgonetka and ordered – the one statuses apply to. */
export function isTracked(state: string): state is TrackedState {
  return TRACKED_STATES.has(state)
}

/** The scans of the API as history entries. */
export function historyEntries(events: TrackingEvent[]): HistoryEntry[] {
  return events.map((event) => ({ status: event.state, at: event.at, label: event.label }))
}

export interface TrackingStep {
  /** The history with the new events, oldest first. */
  history: HistoryEntry[]
  /** The events not in the history before. */
  fresh: HistoryEntry[]
  /** The highest state of the new events, never lower than the current one. */
  state: TrackedState
  /** A new event shows the carrier has (or had) the package – the fulfillment is shipped. */
  scanned: boolean
}

const eventKey = (event: Pick<HistoryEntry, 'status' | 'at'>) =>
  JSON.stringify([event.status, event.at])
const timeOf = (at: string) => Date.parse(at) || 0

/** Where new events take a shipment. A repeated event is no news, so it changes nothing. */
export function trackingStep(
  current: TrackedState,
  history: HistoryEntry[],
  events: HistoryEntry[],
): TrackingStep {
  const seen = new Set(history.map(eventKey))
  const fresh: HistoryEntry[] = []
  for (const event of events) {
    const key = eventKey(event)
    if (seen.has(key)) continue
    seen.add(key)
    fresh.push({ status: event.status, at: event.at, label: event.label })
  }

  let state = current
  let scanned = false
  for (const event of fresh) {
    const effect = trackingEffect(event.status)
    if (effect === 'picked_up' || effect === 'delivered') scanned = true
    const next = EFFECT_STATE[effect]
    if (next && STATE_RANK[next] > STATE_RANK[state]) state = next
  }
  return {
    history: fresh.length
      ? [...history, ...fresh].sort((a, b) => timeOf(a.at) - timeOf(b.at))
      : history,
    fresh,
    state,
    scanned,
  }
}

/** How the alert names the problem states. */
const PROBLEM_NAMES: Record<string, string> = {
  returned: 'zwrot do nadawcy',
  'unexpected-situation': 'nieoczekiwana sytuacja, np. zaginięcie albo uszkodzenie',
}

/**
 * The alert about the latest problem in the history, with what the carrier says; `null` when
 * there is none or the shop was alerted about it already (`alerted_for`).
 */
export function problemAlert(
  history: HistoryEntry[],
  alertedFor: string | null,
): { key: string; message: string } | null {
  const latest = [...history].reverse().find((entry) => trackingEffect(entry.status) === 'problem')
  if (!latest) return null
  const key = `problem:${latest.status}`
  if (alertedFor === key) return null
  const name = PROBLEM_NAMES[latest.status] ?? latest.status
  const label = latest.label?.trim()
  return {
    key,
    message: label ? `Status przewoźnika: „${label}” (${name}).` : `Status przewoźnika: ${name}.`,
  }
}

// ---------------------------------------------------------------------------------------------
// Applying the statuses
// ---------------------------------------------------------------------------------------------

type RowChange = Partial<
  Omit<ShipmentRow, 'id' | 'order_id' | 'created_at' | 'updated_at' | 'deleted_at'>
>

const moduleOf = (container: MedusaContainer) =>
  container.resolve<FurgonetkaModuleService>(FURGONETKA_MODULE)

/** Workflow and module errors may come as plain objects with `message`. */
const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : String((error as { message?: unknown } | null)?.message ?? error)

const dateOf = (value: unknown) => (value ? new Date(value as string | Date) : null)

async function save(
  shipments: FurgonetkaModuleService,
  rowId: string,
  change: RowChange,
): Promise<ShipmentRow> {
  return (await shipments.updateShipments({ id: rowId, ...change })) as ShipmentRow
}

export interface OrderFacts {
  displayId: number | null
  items: { id: string; quantity: number }[]
  fulfillments: {
    id: string
    canceledAt: Date | null
    shippedAt: Date | null
    deliveredAt: Date | null
  }[]
}

export async function orderFacts(container: MedusaContainer, orderId: string): Promise<OrderFacts> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: 'order',
    fields: [
      'display_id',
      'items.id',
      'items.quantity',
      'fulfillments.id',
      'fulfillments.canceled_at',
      'fulfillments.shipped_at',
      'fulfillments.delivered_at',
    ],
    filters: { id: orderId },
  })
  const order = data[0] as unknown as
    | {
        display_id?: number | null
        items?: ({ id: string; quantity: unknown } | null)[]
        fulfillments?: ({
          id: string
          canceled_at: unknown
          shipped_at: unknown
          delivered_at: unknown
        } | null)[]
      }
    | undefined
  return {
    displayId: order?.display_id ? Number(order.display_id) : null,
    items: (order?.items ?? []).flatMap((item) =>
      item ? [{ id: item.id, quantity: Number(item.quantity) }] : [],
    ),
    fulfillments: (order?.fulfillments ?? []).flatMap((fulfillment) =>
      fulfillment
        ? [
            {
              id: fulfillment.id,
              canceledAt: dateOf(fulfillment.canceled_at),
              shippedAt: dateOf(fulfillment.shipped_at),
              deliveredAt: dateOf(fulfillment.delivered_at),
            },
          ]
        : [],
    ),
  }
}

/** The fulfillment the shipment made; a missing or cancelled one leaves the row for later. */
function ownFulfillment(facts: OrderFacts, row: ShipmentRow): OrderFacts['fulfillments'][number] {
  const own = facts.fulfillments.find(
    (fulfillment) => fulfillment.id === row.fulfillment_id && !fulfillment.canceledAt,
  )
  if (!own) {
    throw new Error(
      `Realizacja ${row.fulfillment_id ?? '–'} przesyłki ${row.id} nie istnieje albo jest anulowana.`,
    )
  }
  return own
}

/** The parcel numbers of the row, each with an `http(s)` link – what its labels were made of. */
function labelTracking(row: ShipmentRow): { number: string; url: string }[] {
  return trackingOf(row).map(({ number, url }) => ({
    number,
    url: httpUrl(url) ?? trackingUrl(row.carrier, number),
  }))
}

/** One alert per problem (`alerted_for`); one that cannot go out is tried at the next status. */
async function alertProblem(
  container: MedusaContainer,
  shipments: FurgonetkaModuleService,
  row: ShipmentRow,
  facts: OrderFacts | null,
  now: Date,
): Promise<ShipmentRow> {
  const alert = problemAlert(historyOf(row), row.alerted_for)
  if (!alert) return row
  try {
    const { displayId } = facts ?? (await orderFacts(container, row.order_id))
    const sent = await sendShipmentAlert(
      container,
      'problem',
      { orderId: row.order_id, displayId, message: alert.message },
      now,
    )
    if (sent) return await save(shipments, row.id, { alerted_for: alert.key })
  } catch (error) {
    loggerOf(container).error(
      `Alert o problemie z przesyłką ${row.id} nie wyszedł: ${errorText(error)}`,
    )
  }
  return row
}

/**
 * Applies the carrier's statuses to a shipment (spec 6d §5.7), under the order's lock. New events
 * go to the history; the state only goes up (`STATE_RANK`), so repeated or late events change
 * nothing. The first scan ships the Medusa fulfillment with its labels – `shipment.created` sends
 * „Paczka w drodze” – unless it was shipped by hand already; a delivery delivers it (shipping it
 * first when no scan came before); a problem alerts the shop once.
 */
export async function applyTracking(
  container: MedusaContainer,
  shipmentId: string,
  events: HistoryEntry[],
  now: Date,
): Promise<ShipmentRow> {
  const shipments = moduleOf(container)
  const { order_id: orderId } = await shipments.retrieveShipment(shipmentId)
  return lockShipment(container, orderId, async () => {
    const row = await shipments.retrieveShipment(shipmentId)
    if (!isTracked(row.state)) return row
    const step = trackingStep(row.state, historyOf(row), events)

    const change: RowChange = {}
    if (step.fresh.length) {
      change.history = asJson(step.history)
      change.tracking_status = step.history[step.history.length - 1]?.status ?? null
    }
    const ship = !row.shipped_at && (step.scanned || step.state === 'delivered')
    const deliver = step.state === 'delivered' && !row.delivered_at
    let facts: OrderFacts | null = null
    if (ship || deliver) {
      facts = await orderFacts(container, row.order_id)
      const fulfillment = ownFulfillment(facts, row)
      if (ship) {
        // Shipped by hand („Mark as shipped”) already: the e-mail went out then.
        if (!fulfillment.shippedAt) {
          await createOrderShipmentWorkflow(container).run({
            input: {
              order_id: row.order_id,
              fulfillment_id: fulfillment.id,
              items: facts.items,
              // The shipment replaces the labels of the fulfillment: the same ones go in again.
              labels: fulfillmentLabels(row.id, labelTracking(row)),
              no_notification: false,
            },
          })
        }
        change.shipped_at = fulfillment.shippedAt ?? now
      }
      if (deliver) {
        if (!fulfillment.deliveredAt) {
          await markOrderFulfillmentAsDeliveredWorkflow(container).run({
            input: { orderId: row.order_id, fulfillmentId: fulfillment.id },
          })
        }
        change.delivered_at = fulfillment.deliveredAt ?? now
      }
    }
    if (step.state !== row.state) change.state = step.state

    const saved = Object.keys(change).length ? await save(shipments, row.id, change) : row
    return saved.state === 'problem' ? alertProblem(container, shipments, saved, facts, now) : saved
  })
}

// ---------------------------------------------------------------------------------------------
// The job's pass (`sync-shipments`, every 15 minutes)
// ---------------------------------------------------------------------------------------------

/** A `creating` row with its order command sent this long ago lost the answer – finish it. */
const RESUME_AFTER_MS = 5 * 60_000
/** A `creating` row without a package this long belongs to a run that is gone. */
const ABANDONED_AFTER_MS = 10 * 60_000
/** Statuses are read for shipments up to this old (spec 6d §5.7). */
const TRACK_FOR_MS = 30 * 24 * 60 * 60_000

export const ABANDONED_MESSAGE = 'Tworzenie przesyłki przerwane – spróbuj ponownie'

/**
 * The shipments the job reads statuses for: every state that is not final (spec 6d §5.7) – a
 * `problem` too, so a found parcel still gets delivered when its one webhook was lost – created
 * up to 30 days before `now`.
 */
export function sweepSelector(now: Date) {
  const state: TrackedState[] = ['ready', 'in_transit', 'problem']
  return { state, created_at: { $gte: new Date(now.getTime() - TRACK_FOR_MS) } }
}

const idleFor = (row: Pick<ShipmentRow, 'updated_at'>, now: Date) =>
  now.getTime() - new Date(row.updated_at).getTime()

/** One row's work; its error is logged and never stops the pass. */
async function eachRow(logger: Logger, row: ShipmentRow, job: () => Promise<unknown>) {
  try {
    await job()
  } catch (error) {
    // Another pass holds the order's lock and works on this shipment; the next run looks again.
    if (error instanceof ShipmentActionError) return
    logger.warn(
      `Przesyłka ${row.id} (zamówienie ${row.order_id}) czeka do następnego przeglądu: ${errorText(error)}`,
    )
  }
}

/** Fails a row an interrupted run left without a package; the retry looks it up by reference. */
async function abandon(container: MedusaContainer, row: ShipmentRow, now: Date): Promise<void> {
  const shipments = moduleOf(container)
  await lockShipment(container, row.order_id, async () => {
    const current = await shipments.retrieveShipment(row.id)
    if (current.state !== 'creating' || current.package_id) return
    if (idleFor(current, now) <= ABANDONED_AFTER_MS) return
    await save(shipments, current.id, { state: 'failed', last_error: ABANDONED_MESSAGE })
  })
}

/**
 * The safety net behind the webhook (spec 6d §5.7): gives up `creating` rows without a package,
 * finishes the ones whose order command lost its answer (Task 10 `resumeShipment`) and reads the
 * statuses of shipments not in a final state, up to 30 days old. A row's error is logged and the
 * pass goes on; one that needs a person is left as it is.
 */
export async function sweepShipments(
  container: MedusaContainer,
  now: Date = new Date(),
): Promise<void> {
  const config = furgonetkaConfig(process.env)
  if (!config) return
  const shipments = moduleOf(container)
  const logger = loggerOf(container)

  const creating = (await shipments.listShipments({ state: 'creating' })) as ShipmentRow[]
  for (const row of creating) {
    if (!row.package_id && idleFor(row, now) > ABANDONED_AFTER_MS) {
      await eachRow(logger, row, () => abandon(container, row, now))
    }
  }

  const { state } = await connectionState(container, config)
  if (state !== 'connected') return
  // A token about to end is replaced once here, before the reads below.
  await accessToken(container, config, now)

  for (const row of creating) {
    if (row.package_id && row.order_command_id && idleFor(row, now) > RESUME_AFTER_MS) {
      await eachRow(logger, row, () => resumeShipment(container, row, now))
    }
  }

  const tracked = (await shipments.listShipments(sweepSelector(now))) as ShipmentRow[]
  const client = clientFor(container, config)
  for (const row of tracked) {
    const packageId = row.package_id
    if (!packageId) continue
    await eachRow(logger, row, async () =>
      applyTracking(container, row.id, historyEntries(await client.tracking(packageId)), now),
    )
  }
}

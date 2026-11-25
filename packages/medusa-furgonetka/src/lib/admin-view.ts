import type { MedusaContainer } from '@medusajs/framework/types'
import { MedusaError } from '@medusajs/framework/utils'
import { FURGONETKA_MODULE } from '../modules/furgonetka'
import type FurgonetkaModuleService from '../modules/furgonetka/service'
import type { ShipmentRow, TemplateRow } from '../modules/furgonetka/service'
import {
  type Carrier,
  NOT_CANCELED_MESSAGE,
  type ShipmentPlan,
  type ShipmentReceiver,
} from '../types'
import { cancelBlocker } from './cancel'
import type { AdminShipmentResponse, AdminShipmentView, CardTemplate } from './card-types'
import { carrierForCode, httpUrl } from './carriers'
import { DEFAULT_PICKUP_HOURS, DEFAULT_PICKUP_TODAY_UNTIL, type FurgonetkaConfig } from './config'
import { isFresh } from './create'
import { activeFulfillment, loadShippingOrder, pendingOrderIds, type ShippingOrder } from './order'
import { defaultPickup, type PickupWindow } from './pickup'
import {
  allowedCarriers,
  classPurposeOf,
  keptPackage,
  orderBlocker,
  PAGE_BLOCKERS,
  type PlanSettings,
  planProblems,
  planSettings,
  receiverFromOrder,
  shipmentPlan,
} from './plan'
import type { QueueRow, ShippingQueueResponse } from './queue-types'
import { historyOf, parcelsOf, receiverOf, trackingOf } from './rows'
import { loadSender } from './sender'
import { connectionState } from './tokens'

export type {
  AdminCreateResponse,
  AdminShipmentResponse,
  AdminShipmentView,
  CardTemplate,
} from './card-types'
export type { CreateResult, QueueRow, QueueState, ShippingQueueResponse } from './queue-types'

type LoadOrder = typeof loadShippingOrder

/** Without a setup there are no hours of the shop's own: the defaults of the config. */
const FALLBACK_HOURS = {
  pickupHours: DEFAULT_PICKUP_HOURS,
  pickupTodayUntil: DEFAULT_PICKUP_TODAY_UNTIL,
}

/**
 * Why shipments cannot be created now, for the whole page (spec 6d §5.1, §5.4): the setup, the
 * connection and the warehouse address. The sender is read here once – never per row.
 */
export async function pageBlockers(
  container: MedusaContainer,
  config: FurgonetkaConfig | null,
): Promise<string[]> {
  if (!config) return [PAGE_BLOCKERS.not_configured]
  const blockers: string[] = []
  const { state } = await connectionState(container, config)
  if (state !== 'connected') blockers.push(PAGE_BLOCKERS[state])
  if (!(await loadSender(container))) blockers.push(PAGE_BLOCKERS.sender)
  return blockers
}

/**
 * The plan of an order and what stops it (spec 6d §5.5). With `{ missing }` – the suggestion needs
 * a template nobody set up – the order's own carrier and receiver stay, without parcels, so the
 * form can still be filled in.
 */
function plannedPlan(
  order: ShippingOrder,
  row: ShipmentRow | null,
  templates: TemplateRow[],
  settings: PlanSettings,
): { plan: ShipmentPlan; problems: string[] } {
  const found = shipmentPlan(order, row, templates, settings)
  const problems = planProblems(order, found, settings).map((problem) => problem.message)
  if ('missing' in found) {
    return {
      plan: {
        carrier: carrierForCode(order.deliveryCode, settings.codes),
        receiver: receiverFromOrder(order),
        parcels: [],
        declaredValueCents: order.itemsTotalCents,
        pickup: 'courier',
      },
      problems,
    }
  }
  return { plan: found, problems }
}

/** The plan of a row that is still to be created, in the shape the list shows. */
function plannedRow(
  order: ShippingOrder,
  row: ShipmentRow | null,
  templates: TemplateRow[],
  settings: PlanSettings,
) {
  const { plan, problems } = plannedPlan(order, row, templates, settings)
  return {
    carrier: plan.carrier,
    receiver: plan.receiver,
    parcels: plan.parcels,
    valueCents: plan.declaredValueCents,
    problems,
  }
}

/** The courier window a shipment was created with; `null` for a drop-off or before it is booked. */
function windowOf(row: ShipmentRow): PickupWindow | null {
  return row.pickup_date && row.pickup_from && row.pickup_to
    ? { date: row.pickup_date, from: row.pickup_from, to: row.pickup_to }
    : null
}

function deliveryOf(
  order: ShippingOrder,
  carrier: Carrier,
  receiver: ShipmentReceiver,
  settings: PlanSettings,
) {
  return {
    carrier,
    lockerCode: carrier === 'inpost_locker' ? receiver.point?.trim() || null : null,
    changed: carrier !== carrierForCode(order.deliveryCode, settings.codes),
  }
}

const baseOf = (order: ShippingOrder) => ({
  orderId: order.id,
  displayId: order.displayId,
  customer: order.customerName,
  createdAt: order.createdAt.toISOString(),
})

/**
 * An order still to ship: no shipment yet, a draft, a try under way or a failed one; `null` – it
 * is not for the list. `kept` – the package of its canceled shipment is still in Furgonetka, which
 * blocks it. A try under way blocks it while it is fresh – the same rule that answers „busy” –
 * and a stale one can be taken up again.
 */
function newRow(
  order: ShippingOrder,
  row: ShipmentRow | null,
  templates: TemplateRow[],
  {
    blocked,
    kept,
    now,
    settings,
  }: { blocked: boolean; kept: boolean; now: Date; settings: PlanSettings },
): QueueRow | null {
  // The same rules that let a shipment be created: shop, paid, not canceled, nothing made yet.
  if (!order.shopOrder || orderBlocker(order, row)) return null
  const planned = plannedRow(order, row, templates, settings)
  const problems = kept ? [NOT_CANCELED_MESSAGE, ...planned.problems] : planned.problems
  const busy = row?.state === 'creating' && isFresh(row, now)
  return {
    ...baseOf(order),
    delivery: deliveryOf(order, planned.carrier, planned.receiver, settings),
    parcels: planned.parcels,
    valueCents: planned.valueCents,
    shipmentId: row?.id ?? null,
    state: row?.state === 'failed' || row?.state === 'creating' ? row.state : 'new',
    pickup: null,
    pickupStatus: null,
    pickupWindow: null,
    error: row?.state === 'failed' ? row.last_error : null,
    problems,
    selectable: problems.length === 0 && !blocked && !busy,
  }
}

/** A created shipment the carrier has not scanned yet. */
function readyRow(
  order: ShippingOrder,
  row: ShipmentRow,
  blocked: boolean,
  settings: PlanSettings,
): QueueRow {
  return {
    ...baseOf(order),
    delivery: deliveryOf(order, row.carrier, receiverOf(row), settings),
    parcels: parcelsOf(row),
    valueCents: row.declared_value_cents,
    shipmentId: row.id,
    state: 'ready',
    pickup: row.pickup,
    pickupStatus: row.pickup_status,
    pickupWindow: windowOf(row),
    error: row.last_error,
    problems: [],
    selectable: !blocked,
  }
}

/**
 * The „Do wysyłki” list (spec 6d §5.4), the oldest order first: paid shop orders without a
 * fulfillment (`new`, also with a draft, `creating` or `failed`) and the shipments Furgonetka has
 * made that the carrier has not scanned yet (`ready`). Only these are loaded – `pendingOrderIds`
 * keeps the orders that were shipped long ago out, and the ready ones come from the shipment table.
 */
export async function pendingShipments(
  container: MedusaContainer,
  config: FurgonetkaConfig | null,
  now: Date,
  load: LoadOrder = loadShippingOrder,
): Promise<ShippingQueueResponse> {
  const blockers = await pageBlockers(container, config)
  const blocked = blockers.length > 0
  const shipments = container.resolve<FurgonetkaModuleService>(FURGONETKA_MODULE)

  const candidates = await pendingOrderIds(container)
  const ready = (await shipments.listShipments({ state: 'ready' }, { take: null })) as ShipmentRow[]
  const active = candidates.length
    ? ((await shipments.listShipments(
        { order_id: candidates, state: { $ne: 'canceled' } },
        { take: null },
      )) as ShipmentRow[])
    : []
  const rowOf = new Map<string, ShipmentRow>()
  for (const row of [...active, ...ready]) rowOf.set(row.order_id, row)
  // For an order without an active row, its newest canceled row is its newest row – the card's
  // `latestShipment`: a package Furgonetka kept there blocks the order on the list as well.
  const canceled = candidates.length
    ? ((await shipments.listShipments(
        { order_id: candidates, state: 'canceled' },
        { order: { created_at: 'DESC', id: 'DESC' }, take: null },
      )) as ShipmentRow[])
    : []
  const latestCanceled = new Map<string, ShipmentRow>()
  for (const row of canceled) {
    if (!latestCanceled.has(row.order_id)) latestCanceled.set(row.order_id, row)
  }

  const templates = (await shipments.listParcelTemplates({}, { take: null })) as TemplateRow[]
  const settings = planSettings(container)
  const rows: QueueRow[] = []
  for (const orderId of new Set([...candidates, ...ready.map((row) => row.order_id)])) {
    const order = await load(container, orderId)
    if (!order) continue
    const row = rowOf.get(orderId) ?? null
    const kept = !row && keptPackage(latestCanceled.get(orderId) ?? null) !== null
    const entry =
      row?.state === 'ready'
        ? readyRow(order, row, blocked, settings)
        : newRow(order, row, templates, { blocked, kept, now, settings })
    if (entry) rows.push(entry)
  }
  rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.displayId - b.displayId)

  return {
    configured: config !== null,
    blockers,
    defaultPickup: defaultPickup(now, config ?? FALLBACK_HOURS),
    rows,
  }
}

// ---------------------------------------------------------------------------------------------
// The „Wysyłka” card of an order (spec 6d §5.5)
// ---------------------------------------------------------------------------------------------

/** States of a shipment whose package is ordered in Furgonetka, so it has a label. */
export const LABEL_STATES: string[] = ['ready', 'in_transit', 'delivered', 'problem']
/** States of a row that is still a plan: the form edits it. */
const PLAN_STATES: string[] = ['draft', 'failed']

/** The shipment row as the card shows it. */
export function adminShipmentView(row: ShipmentRow): AdminShipmentView {
  return {
    id: row.id,
    state: row.state,
    carrier: row.carrier,
    // The link ends up in a `href`: only `http(s)` goes out.
    tracking: trackingOf(row).map((entry) => ({ number: entry.number, url: httpUrl(entry.url) })),
    pickup: row.pickup,
    pickupStatus: row.pickup_status,
    pickupWindow: windowOf(row),
    history: historyOf(row),
    lastError: row.last_error,
    cancelError: row.cancel_error,
  }
}

const templateView = (template: TemplateRow): CardTemplate => ({
  id: template.id,
  name: template.name,
  kind: template.kind,
  length_cm: template.length_cm,
  width_cm: template.width_cm,
  height_cm: template.height_cm,
  weight_g: template.weight_g,
  purpose: template.purpose,
})

/**
 * The card of an order; 404 for an unknown order. `plan` is what the form starts from – the
 * draft (or the plan of a failed try) of the order's row, else the suggestion – and is `null`
 * when the order cannot be planned: no setup, not paid, canceled, fulfilled, or with a shipment
 * past the draft. `shipment` is the order's row that is not canceled, or the newest canceled one
 * whose package Furgonetka kept (`cancel_error`) – then the form stays closed, as no second
 * shipment may be made. A fulfillment without a draft that went on to become a shipment is a
 * manual one.
 */
export async function loadAdminShipment(
  container: MedusaContainer,
  config: FurgonetkaConfig | null,
  orderId: string,
  now: Date,
  load: LoadOrder = loadShippingOrder,
): Promise<AdminShipmentResponse> {
  const order = await load(container, orderId)
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Nie znaleziono zamówienia ${orderId}.`)
  }
  const shipments = container.resolve<FurgonetkaModuleService>(FURGONETKA_MODULE)
  const active = await shipments.activeShipment(orderId)
  const kept = active ? null : keptPackage(await shipments.latestShipment(orderId))
  const shown = active ?? kept
  const templates = (await shipments.listParcelTemplates({}, { take: null })) as TemplateRow[]
  const blockers = await pageBlockers(container, config)
  const settings = planSettings(container)

  const manualFulfillment =
    activeFulfillment(order) !== null && (!active || PLAN_STATES.includes(active.state))
  const planned =
    config && !orderBlocker(order, active) ? plannedPlan(order, active, templates, settings) : null
  const draft = planned !== null && active !== null && PLAN_STATES.includes(active.state)
  // A row that is being created is not to be touched until the creation ends; nor is the plan of
  // an order whose canceled package Furgonetka still has.
  const editable = planned !== null && active?.state !== 'creating' && kept === null

  return {
    configured: config !== null,
    blockers,
    order: {
      paid: order.paid,
      canceled: order.canceled,
      bulky: order.items.some((item) => item.parcelClass !== null),
      allowedCarriers: allowedCarriers(order, settings),
      classPurpose: classPurposeOf(order, settings),
      manualFulfillment,
    },
    plan: planned?.plan ?? null,
    draft,
    problems: planned?.problems ?? [],
    shipment: shown ? adminShipmentView(shown) : null,
    templates: templates.map(templateView),
    defaultPickup: defaultPickup(now, config ?? FALLBACK_HOURS),
    simulate: config?.client === 'fake' && process.env.NODE_ENV !== 'production',
    actions: {
      save: editable,
      create: editable && blockers.length === 0,
      restore: editable && draft,
      cancel: config !== null && shown !== null && cancelBlocker(shown) === null,
      pickup:
        config !== null &&
        shown?.state === 'ready' &&
        shown.pickup === 'courier' &&
        shown.pickup_status === 'failed',
      label:
        config !== null &&
        shown !== null &&
        Boolean(shown.package_id) &&
        LABEL_STATES.includes(shown.state),
    },
  }
}

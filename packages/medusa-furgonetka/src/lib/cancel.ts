import type { Logger, MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { cancelOrderFulfillmentWorkflow } from '@medusajs/medusa/core-flows'
import { FURGONETKA_MODULE } from '../modules/furgonetka'
import type FurgonetkaModuleService from '../modules/furgonetka/service'
import type { ShipmentRow } from '../modules/furgonetka/service'
import { sendShipmentAlert } from './alerts'
import { FurgonetkaError } from './api-errors'
import type { FurgonetkaClient } from './client'
import { furgonetkaConfig } from './config'
import { clientFor } from './connect'
import {
  BUSY_MESSAGE,
  cancelPackageQuietly,
  errorText,
  lockShipment,
  NO_SHIPMENT_MESSAGE,
  NOT_CANCELED_MESSAGE,
  packageStep,
  ShipmentActionError,
} from './create'
import { prefixedLogger as loggerOf } from './log'
import { PAGE_BLOCKERS } from './plan'
import { connectionState } from './tokens'
import { orderFacts } from './tracking'

export const AT_CARRIER_MESSAGE =
  'Przesyłka jest już u przewoźnika – anulowanie tylko przez Furgonetkę'
export const REFUSED_MESSAGE = 'Furgonetka odmówiła anulowania – sprawdź przesyłkę w Furgonetce'
export const FULFILLMENT_NOT_CANCELED_MESSAGE =
  'Przesyłka anulowana w Furgonetce, ale realizacji w Medusie nie udało się anulować – anuluj ją w panelu zamówienia.'
export const ALREADY_CANCELED_MESSAGE = 'Przesyłka jest już anulowana.'
export const NOT_ORDERED_MESSAGE = 'Przesyłka nie jest jeszcze zamówiona – nie ma czego anulować.'

/** The `alerted_for` of the one alert about a package that is still in Furgonetka. */
const ALERT_KEY = 'not_canceled'

type RowChange = Partial<
  Omit<ShipmentRow, 'id' | 'order_id' | 'created_at' | 'updated_at' | 'deleted_at'>
>

const moduleOf = (container: MedusaContainer) =>
  container.resolve<FurgonetkaModuleService>(FURGONETKA_MODULE)

async function save(
  shipments: FurgonetkaModuleService,
  rowId: string,
  change: RowChange,
): Promise<ShipmentRow> {
  return (await shipments.updateShipments({ id: rowId, ...change })) as ShipmentRow
}

/** The API client of the connected account, or why the shop cannot reach Furgonetka now. */
async function connectedClient(
  container: MedusaContainer,
): Promise<{ client: FurgonetkaClient } | { blocked: string }> {
  const config = furgonetkaConfig(process.env)
  if (!config) return { blocked: PAGE_BLOCKERS.not_configured }
  const { state } = await connectionState(container, config)
  if (state !== 'connected') return { blocked: PAGE_BLOCKERS[state] }
  return { client: clientFor(container, config) }
}

/** Whether the package is cancelled in Furgonetka or gone from it; `false` when nobody can say. */
async function packageGone(client: FurgonetkaClient, packageId: string): Promise<boolean> {
  try {
    return packageStep(await client.getPackage(packageId)) === 'create'
  } catch (error) {
    return error instanceof FurgonetkaError && error.kind === 'not_found'
  }
}

/**
 * Why „Anuluj przesyłkę” does not apply to the row (spec 6d §5.9), `null` when it does: a `ready`
 * row (nothing scanned yet), or a `canceled` one that still carries the `cancel_error` of a
 * package Furgonetka did not cancel – that one is tried again.
 */
export function cancelBlocker(row: Pick<ShipmentRow, 'state' | 'cancel_error'>): string | null {
  switch (row.state) {
    case 'ready':
      return null
    case 'canceled':
      return row.cancel_error ? null : ALREADY_CANCELED_MESSAGE
    case 'in_transit':
    case 'delivered':
    case 'problem':
      return AT_CARRIER_MESSAGE
    case 'creating':
      return BUSY_MESSAGE
    default:
      return NOT_ORDERED_MESSAGE
  }
}

/**
 * „Anuluj przesyłkę” in the card (spec 6d §5.9), under the order's lock. The package is canceled
 * in Furgonetka first (a refusal changes nothing); then the row turns `canceled` and only then
 * the Medusa fulfillment is canceled – so the `order.fulfillment_canceled` subscriber, which
 * waits for this lock, finds no active row and leaves it alone. A fulfillment that cannot be
 * canceled leaves the row `canceled` and the error says to do it in the order panel (the
 * subscriber then finds no active row either). A `canceled` row with a `cancel_error` – a native
 * fulfillment cancel Furgonetka did not take – only cancels the package again, or clears the flag
 * when the package is canceled in Furgonetka already.
 */
export async function cancelShipment(
  container: MedusaContainer,
  shipmentId: string,
  now: Date = new Date(),
): Promise<ShipmentRow> {
  const shipments = moduleOf(container)
  const [found] = (await shipments.listShipments({ id: shipmentId }, { take: 1 })) as ShipmentRow[]
  if (!found) throw new ShipmentActionError(NO_SHIPMENT_MESSAGE)

  return lockShipment(container, found.order_id, async () => {
    // The row may have moved on while this call waited for the lock.
    const row = await shipments.retrieveShipment(shipmentId)
    const blocker = cancelBlocker(row)
    if (blocker) throw new ShipmentActionError(blocker)

    const access = await connectedClient(container)
    if ('blocked' in access) throw new ShipmentActionError(access.blocked)
    const logger = loggerOf(container)
    const packageId = row.package_id
    const cancelPackage = async () => {
      if (packageId && !(await cancelPackageQuietly(access.client, logger, packageId))) {
        throw new ShipmentActionError(REFUSED_MESSAGE)
      }
    }

    if (row.state === 'canceled') {
      // The operator may have canceled it in Furgonetka's own panel, which then refuses to cancel
      // it again: a package that is gone clears the flag as it is.
      if (packageId && !(await packageGone(access.client, packageId))) await cancelPackage()
      return save(shipments, row.id, { cancel_error: null })
    }

    const facts = await orderFacts(container, row.order_id)
    const fulfillment = facts.fulfillments.find((entry) => entry.id === row.fulfillment_id)
    // Shipped by hand („Mark as shipped”): the parcel is with the carrier, though no scan came yet.
    if (fulfillment?.shippedAt) throw new ShipmentActionError(AT_CARRIER_MESSAGE)

    await cancelPackage()
    const canceled = await save(shipments, row.id, {
      state: 'canceled',
      canceled_at: now,
      cancel_error: null,
    })
    if (fulfillment && !fulfillment.canceledAt) {
      try {
        await cancelOrderFulfillmentWorkflow(container).run({
          input: { order_id: row.order_id, fulfillment_id: fulfillment.id, no_notification: true },
        })
      } catch (error) {
        logger.error(
          `Realizacja ${fulfillment.id} przesyłki ${row.id} nie została anulowana w Medusie: ${errorText(error)}`,
        )
        throw new ShipmentActionError(FULFILLMENT_NOT_CANCELED_MESSAGE)
      }
    }
    return canceled
  })
}

/** The shipment of a fulfillment, if it is not canceled yet. */
async function activeByFulfillment(
  shipments: FurgonetkaModuleService,
  fulfillmentId: string,
): Promise<ShipmentRow | null> {
  const [row] = (await shipments.listShipments(
    { fulfillment_id: fulfillmentId, state: { $ne: 'canceled' } },
    { take: 1 },
  )) as ShipmentRow[]
  return row ?? null
}

/** Cancels the package of a native fulfillment cancel; `false` for whatever keeps it in Furgonetka. */
async function cancelQuietly(
  container: MedusaContainer,
  rowId: string,
  packageId: string,
): Promise<boolean> {
  const logger = loggerOf(container)
  try {
    const access = await connectedClient(container)
    if ('client' in access) return await cancelPackageQuietly(access.client, logger, packageId)
    logger.warn(`Przesyłka ${rowId} nie została anulowana w Furgonetce: ${access.blocked}`)
  } catch (error) {
    logger.error(`Przesyłka ${rowId} nie została anulowana w Furgonetce: ${errorText(error)}`)
  }
  return false
}

/** One alert for a package that stays in Furgonetka; one that cannot go out is only logged. */
async function alertNotCanceled(
  container: MedusaContainer,
  shipments: FurgonetkaModuleService,
  row: ShipmentRow,
  now: Date,
): Promise<void> {
  if (row.alerted_for === ALERT_KEY) return
  try {
    const { displayId } = await orderFacts(container, row.order_id)
    const sent = await sendShipmentAlert(
      container,
      'not_canceled',
      { orderId: row.order_id, displayId, message: NOT_CANCELED_MESSAGE },
      now,
    )
    if (sent) await save(shipments, row.id, { alerted_for: ALERT_KEY })
  } catch (error) {
    loggerOf(container).error(
      `Alert o nieanulowanej przesyłce ${row.id} nie wyszedł: ${errorText(error)}`,
    )
  }
}

/**
 * The `order.fulfillment_canceled` subscriber's work (spec 6d §5.9): the fulfillment of an active
 * shipment was canceled in the Medusa panel, so the package goes too. A `ready` row cancels the
 * package and turns `canceled`. When Furgonetka does not take it – or the parcel is past the first
 * scan – the row turns `canceled` with the `cancel_error` the card shows, and the shop gets one
 * `not_canceled` alert. A fulfillment without an active row (a manual one, or the one
 * `cancelShipment` is canceling right now) changes nothing.
 */
export async function cancelShipmentOfFulfillment(
  container: MedusaContainer,
  fulfillmentId: string,
  now: Date = new Date(),
): Promise<void> {
  const shipments = moduleOf(container)
  // Most fulfillments never had a shipment: look before taking a lock.
  const known = await activeByFulfillment(shipments, fulfillmentId)
  if (!known) return

  await lockShipment(container, known.order_id, async () => {
    // Re-read under the lock: `cancelShipment` may have canceled the row in the meantime.
    const row = await activeByFulfillment(shipments, fulfillmentId)
    if (!row) return

    const canceled =
      row.state === 'ready' &&
      (!row.package_id || (await cancelQuietly(container, row.id, row.package_id)))
    if (canceled) {
      await save(shipments, row.id, { state: 'canceled', canceled_at: now, cancel_error: null })
      return
    }
    const failed = await save(shipments, row.id, {
      state: 'canceled',
      canceled_at: now,
      cancel_error: NOT_CANCELED_MESSAGE,
    })
    await alertNotCanceled(container, shipments, failed, now)
  })
}

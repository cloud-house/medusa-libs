import type { ShipmentRow } from '../modules/furgonetka/service'
import type { HistoryEntry, ParcelSpec, ShipmentReceiver } from '../types'

/**
 * Typed reads of the JSON columns of a shipment row. `model.json()` types them as records, so each
 * accessor holds the one cast; everything that reads a row goes through these.
 */

export function parcelsOf(row: ShipmentRow): ParcelSpec[] {
  return row.parcels as unknown as ParcelSpec[]
}

/** The parcel numbers with their tracking links; empty until the package is created. */
export function trackingOf(row: ShipmentRow): { number: string; url: string | null }[] {
  return (row.tracking as unknown as { number: string; url: string | null }[] | null) ?? []
}

/** The status history; empty before the first status. */
export function historyOf(row: ShipmentRow): HistoryEntry[] {
  return (row.history as unknown as HistoryEntry[] | null) ?? []
}

export function receiverOf(row: ShipmentRow): ShipmentReceiver {
  return row.receiver as unknown as ShipmentReceiver
}

/** The value for a JSON column on write – the DML types those columns as records, the cast is here. */
export function asJson(
  value:
    | ShipmentReceiver
    | ParcelSpec[]
    | { number: string; url: string | null }[]
    | HistoryEntry[],
): Record<string, unknown> {
  return value as unknown as Record<string, unknown>
}

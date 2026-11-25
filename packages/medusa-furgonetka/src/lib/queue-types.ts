import type { Carrier, ParcelSpec } from '../types'
import type { PickupWindow } from './pickup'

/**
 * What the „Do wysyłki” routes send to the panel (spec 6d §5.4). A module of its own without
 * server imports: the admin typecheck follows imports, and the module service has decorators it
 * cannot read. `admin-view.ts` and `create.ts` build these.
 */

/**
 * `new` – nothing is made yet (a draft too); `creating` – a try is under way, or died on the way;
 * `failed` – the last try ended with `error`; `ready` – the label exists.
 */
export type QueueState = 'new' | 'creating' | 'ready' | 'failed'

/** One line of the „Do wysyłki” list. */
export interface QueueRow {
  orderId: string
  displayId: number
  customer: string
  /** ISO time the order was placed. */
  createdAt: string
  /** What the parcel goes by: the planned (or created) carrier, `changed` – not the customer's. */
  delivery: { carrier: Carrier; lockerCode: string | null; changed: boolean }
  /** The suggested, drafted or created parcels. */
  parcels: ParcelSpec[]
  valueCents: number
  /** The shipment row, `null` while the order has none. */
  shipmentId: string | null
  state: QueueState
  /** How a created shipment leaves; `null` before it exists. */
  pickup: 'courier' | 'drop_off' | null
  pickupStatus: 'none' | 'ordered' | 'failed' | null
  pickupWindow: PickupWindow | null
  /** Why the last try failed (`failed`) or the pickup was not ordered (`ready`). */
  error: string | null
  /** What stops the row from being selected; each one is solved in the card „Wysyłka”. */
  problems: string[]
  /** Also `false` for a shipment a running try is creating now (it would only answer „busy”). */
  selectable: boolean
}

export interface ShippingQueueResponse {
  configured: boolean
  /** Why nothing can be created now (the banner); empty – the list works. */
  blockers: string[]
  defaultPickup: PickupWindow
  rows: QueueRow[]
}

/** The outcome for one order of a batch (one shipment of a pickup retry); `ok` – the label is ready. */
export interface CreateResult {
  orderId: string
  shipmentId: string | null
  ok: boolean
  message: string | null
}

import type { Carrier, HistoryEntry, ShipmentPlan, TemplateKind, TemplatePurpose } from '../types'
import type { PickupWindow } from './pickup'
import type { CreateResult } from './queue-types'

/**
 * What the „Wysyłka” card of an order sends and receives (spec 6d §5.5). A module of its own
 * without server imports, like `queue-types.ts`: the admin typecheck follows imports, and the
 * module service has decorators it cannot read. `admin-view.ts` builds these.
 */

/** How a batch hands its parcels over: the courier collects them, or the shop takes them to a point. */
export type PickupChoice =
  | { type: 'courier'; date: string; from: string; to: string }
  | { type: 'drop_off' }

export type ShipmentState =
  | 'draft'
  | 'creating'
  | 'failed'
  | 'ready'
  | 'in_transit'
  | 'delivered'
  | 'problem'
  | 'canceled'

/** The shipment row as the card shows it. */
export interface AdminShipmentView {
  id: string
  state: ShipmentState
  carrier: Carrier
  /** The numbers of the parcels; `url` is an `http(s)` tracking link or `null`. */
  tracking: { number: string; url: string | null }[]
  pickup: 'courier' | 'drop_off'
  pickupStatus: 'none' | 'ordered' | 'failed'
  pickupWindow: PickupWindow | null
  history: HistoryEntry[]
  /** Why the last creation (`failed`) or the pickup order (`ready`) did not work. */
  lastError: string | null
  /** Set on a `canceled` row whose package Furgonetka did not cancel. */
  cancelError: string | null
}

/** A parcel template as the card offers it. */
export interface CardTemplate {
  id: string
  name: string
  kind: TemplateKind
  length_cm: number
  width_cm: number
  height_cm: number
  weight_g: number
  purpose: TemplatePurpose | null
}

/** `GET /admin/orders/:id/shipment`. */
export interface AdminShipmentResponse {
  configured: boolean
  /** Why nothing can be created now (setup, connection, warehouse address); empty – it works. */
  blockers: string[]
  order: {
    paid: boolean
    canceled: boolean
    /** Some item has a parcel class. */
    bulky: boolean
    /** The carriers that take every item of the order. */
    allowedCarriers: Carrier[]
    /** The key of the first parcel class among the items (the carton for a courier), else `null`. */
    classPurpose: string | null
    manualFulfillment: boolean
  }
  /** What the form starts from; `null` – the order cannot be planned (shipped, fulfilled by hand…). */
  plan: ShipmentPlan | null
  /** The plan is a saved draft (or the plan of a failed try), not the suggestion. */
  draft: boolean
  /** What stops the plan from being created, each one solved in the form. */
  problems: string[]
  /** The order's shipment that is not canceled, or the newest canceled one Furgonetka kept. */
  shipment: AdminShipmentView | null
  templates: CardTemplate[]
  defaultPickup: PickupWindow
  /** The fake Furgonetka is in use outside production: „Symuluj odbiór” and „Symuluj doręczenie”. */
  simulate: boolean
  actions: {
    save: boolean
    create: boolean
    restore: boolean
    cancel: boolean
    pickup: boolean
    label: boolean
  }
}

/** The answer of `POST …/shipment/create`: the card as it is after the try, and the outcome. */
export interface AdminCreateResponse extends AdminShipmentResponse {
  result: CreateResult
}

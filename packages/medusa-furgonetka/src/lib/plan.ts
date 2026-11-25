import { isPolishMobile } from '@cloud-house/commerce-rules'
import type { MedusaContainer } from '@medusajs/framework/types'
import type { ShipmentRow, TemplateRow } from '../modules/furgonetka/service'
import type { ParcelClass } from '../options'
import {
  type Carrier,
  purposeLabel,
  type ShipmentPlan,
  type ShipmentReceiver,
  type TemplatePurpose,
} from '../types'
import { carrierForCode, type DeliveryCodes } from './carriers'
import { normalizeLockerCode } from './locker'
import { activeFulfillment, type ShippingOrder } from './order'
import { suggestParcels } from './parcels'
import { furgonetkaOptions } from './plugin-options'
import { parcelsOf, receiverOf } from './rows'
import { EXPIRED_MESSAGE, NOT_CONFIGURED_MESSAGE, NOT_CONNECTED_MESSAGE } from './tokens'

/** States of a row that is still to be created: its plan is the draft. */
const DRAFT_STATES: string[] = ['draft', 'failed', 'creating']
/** States of a shipment that exists in Furgonetka – from `ready` on. */
const SHIPMENT_STATES: string[] = ['ready', 'in_transit', 'delivered', 'problem']

/** What planning needs from the plugin options: the parcel classes and the InPost delivery codes. */
export interface PlanSettings {
  classes: (Pick<ParcelClass, 'key' | 'label'> & { carriers: Carrier[] })[]
  codes: DeliveryCodes
}

/** The plan settings of the shop (`parcelClasses`, `deliveryCodes` options). */
export function planSettings(container: Pick<MedusaContainer, 'resolve'>): PlanSettings {
  const { parcelClasses, deliveryCodes } = furgonetkaOptions(container)
  return { classes: parcelClasses, codes: deliveryCodes }
}

// The plan type lives in `types.ts`, which has no server imports, so the admin panel can use it.
export type { ShipmentPlan }

/** Why the list cannot create shipments at all (spec 6d §5.1, §5.4); the banner of the page. */
export const PAGE_BLOCKERS = {
  not_configured: NOT_CONFIGURED_MESSAGE,
  not_connected: NOT_CONNECTED_MESSAGE,
  disconnected: EXPIRED_MESSAGE,
  sender: 'Uzupełnij adres i telefon magazynu (Settings → Locations)',
} as const

/**
 * `+48` and nine digits, like the storefront writes a phone. A number that does not parse stays
 * as the customer typed it (trimmed) – the problems decide whether it blocks.
 */
export function normalizePhone(value: string | null): string {
  const digits = (value ?? '').replace(/[\s\-()]/g, '').replace(/^(\+48|0048)/, '')
  return /^\d{9}$/.test(digits) ? `+48${digits}` : (value ?? '').trim()
}

const joined = (parts: (string | null | undefined)[]) =>
  parts.filter((part): part is string => Boolean(part?.trim())).join(' ')

/** The receiver as the order has it: the delivery address (street with `address_2`) and the locker. */
export function receiverFromOrder(order: ShippingOrder): ShipmentReceiver {
  const { address } = order
  return {
    name: order.customerName,
    company: address?.company ?? null,
    phone: normalizePhone(address?.phone ?? null),
    email: order.email,
    street: joined([address?.address1, address?.address2]) || null,
    postal_code: address?.postalCode ?? null,
    city: address?.city ?? null,
    point: order.lockerCode,
    point_label: order.lockerCode ? order.lockerLabel : null,
  }
}

/**
 * The plan for an order (spec 6d §5.5): a row that is still to be created (`draft`, `failed`,
 * `creating`) gives its own plan, anything else gets the suggestion – the carrier of the delivery
 * method, the receiver and the parcels of the order, the items total as the declared value and a
 * courier pickup. `{ missing }` – the suggestion needs a template that nobody set up.
 */
export function shipmentPlan(
  order: ShippingOrder,
  row: ShipmentRow | null,
  templates: TemplateRow[],
  settings: PlanSettings,
): ShipmentPlan | { missing: TemplatePurpose } {
  if (row && DRAFT_STATES.includes(row.state)) {
    return {
      carrier: row.carrier,
      receiver: receiverOf(row),
      parcels: parcelsOf(row),
      declaredValueCents: row.declared_value_cents,
      pickup: row.pickup,
    }
  }
  const carrier = carrierForCode(order.deliveryCode, settings.codes)
  const parcels = suggestParcels(order.items, carrier, templates, settings.classes)
  if (!Array.isArray(parcels)) return parcels
  return {
    carrier,
    receiver: receiverFromOrder(order),
    parcels,
    declaredValueCents: order.itemsTotalCents,
    pickup: 'courier',
  }
}

/** Whether an item of the order has a parcel class the carrier does not take (a bulky item with InPost). */
export function classRefuses(
  order: ShippingOrder,
  carrier: Carrier,
  settings: PlanSettings,
): boolean {
  return order.items.some(
    (item) =>
      Boolean(item.parcelClass) &&
      !(
        settings.classes.find((candidate) => candidate.key === item.parcelClass)?.carriers ?? [
          'dpd',
        ]
      ).includes(carrier),
  )
}

/** What stops an order from being selected on the list; each one is solved by a draft (§5.4). */
export interface ShippingProblem {
  code: 'bulky_inpost' | 'locker_code' | 'locker_phone' | 'address' | 'template'
  message: string
}

const MESSAGES = {
  bulky_inpost:
    'Sprawdź dostawę: produkt wysyłany tylko kurierem DPD – zmień przewoźnika w karcie „Wysyłka”.',
  locker_code: 'Paczkomat bez kodu – wpisz kod w karcie „Wysyłka”.',
  locker_phone: 'Numer stacjonarny przy paczkomacie – wpisz numer komórkowy w karcie „Wysyłka”.',
  address: 'Brak adresu dostawy – uzupełnij go w karcie „Wysyłka”.',
} as const

/**
 * The problems of the plan. A bulky item blocks every carrier but DPD – judged by the items and the
 * planned carrier, so a flagged order whose draft goes by DPD is clear. A locker needs a code and a
 * mobile number, a courier a street, a postal code and a city. With `{ missing }` the carrier and
 * the receiver are the order's own, so the other problems still show next to the template one.
 */
export function planProblems(
  order: ShippingOrder,
  plan: ShipmentPlan | { missing: TemplatePurpose },
  settings: PlanSettings,
): ShippingProblem[] {
  const missing = 'missing' in plan ? plan.missing : null
  const carrier =
    'missing' in plan ? carrierForCode(order.deliveryCode, settings.codes) : plan.carrier
  const receiver = 'missing' in plan ? receiverFromOrder(order) : plan.receiver
  const problems: ShippingProblem[] = []
  const add = (code: keyof typeof MESSAGES) => problems.push({ code, message: MESSAGES[code] })

  if (classRefuses(order, carrier, settings)) add('bulky_inpost')
  if (carrier === 'inpost_locker') {
    if (!normalizeLockerCode(receiver.point)) add('locker_code')
    if (!isPolishMobile(receiver.phone)) add('locker_phone')
  } else if (!receiver.street?.trim() || !receiver.postal_code?.trim() || !receiver.city?.trim()) {
    add('address')
  }
  if (missing) {
    problems.push({
      code: 'template',
      message: `Brak szablonu paczki „${purposeLabel(missing, settings.classes)}” – ustaw go w Settings → Wysyłka.`,
    })
  }
  return problems
}

/**
 * The order's newest shipment (`latest`, any state) when it is a canceled one whose package
 * Furgonetka kept (`cancel_error`, spec 6d §5.9). That package is paid and may still travel, so
 * the order gets no second shipment – nor a draft of one – until the package is canceled in
 * Furgonetka and „Anuluj przesyłkę” in the card clears the flag. A newer row supersedes it.
 */
export function keptPackage(latest: ShipmentRow | null): ShipmentRow | null {
  return latest?.state === 'canceled' && latest.cancel_error ? latest : null
}

/**
 * Why shipments cannot be created for the order, `null` when they can (spec 6d §5.6 step 1).
 * `active` is the order's shipment that is not canceled. A shipment from `ready` on has created a
 * fulfillment too, so it is named first.
 */
export function orderBlocker(order: ShippingOrder, active: ShipmentRow | null): string | null {
  if (!order.paid) return 'Zamówienie nie jest opłacone.'
  if (order.canceled) return 'Zamówienie jest anulowane.'
  if (active && SHIPMENT_STATES.includes(active.state)) return 'Zamówienie ma już przesyłkę.'
  if (activeFulfillment(order)) return 'Zamówienie ma już realizację.'
  return null
}

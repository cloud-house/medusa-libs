import { isPolishMobile, MOBILE_FOR_LOCKER } from '@cloud-house/commerce-rules'
import type { MedusaContainer } from '@medusajs/framework/types'
import { FURGONETKA_MODULE } from '../modules/furgonetka'
import type FurgonetkaModuleService from '../modules/furgonetka/service'
import type { ShipmentRow } from '../modules/furgonetka/service'
import {
  type Carrier,
  NOT_CANCELED_MESSAGE,
  type ParcelSpec,
  type ShipmentReceiver,
} from '../types'
import { FurgonetkaError } from './api-errors'
import type { PackageInfo } from './client'
import { furgonetkaConfig } from './config'
import { clientFor } from './connect'
import {
  BUSY_MESSAGE,
  lockShipment,
  NO_ORDER_MESSAGE,
  packageStep,
  ShipmentActionError,
} from './create'
import { normalizeLockerCode } from './locker'
import { loadShippingOrder } from './order'
import {
  classRefuses,
  keptPackage,
  normalizePhone,
  orderBlocker,
  PAGE_BLOCKERS,
  planSettings,
} from './plan'
import { asJson, parcelsOf, receiverOf } from './rows'

/** What the „Wysyłka” card saves as the plan of a shipment (spec 6d §5.5). */
export interface DraftInput {
  carrier: Carrier
  receiver: ShipmentReceiver
  parcels: ParcelSpec[]
  declaredValueCents: number
  pickup: 'courier' | 'drop_off'
}

/** The parcel limit of DPD and of the InPost courier. */
const MAX_PARCELS = 15
const DPD_MAX_WEIGHT_G = 31_500
const LOCKER_KINDS: string[] = ['locker_a', 'locker_b', 'locker_c']

const BULKY_MESSAGE = 'Ten produkt wysyłamy tylko kurierem DPD.'
const PARCEL_COUNT_MESSAGE = `Przesyłka musi mieć od 1 do ${MAX_PARCELS} paczek.`
const DIMENSIONS_MESSAGE = 'Wymiary i waga paczki muszą być dodatnimi liczbami całkowitymi.'
const DPD_WEIGHT_MESSAGE = 'Paczka DPD może ważyć od 1 g do 31,5 kg.'
const VALUE_MESSAGE = 'Wartość deklarowana nie może być ujemna.'
const LOCKER_PARCEL_MESSAGE =
  'Przesyłka do paczkomatu ma zawsze jedną paczkę o gabarycie A, B albo C.'
const LOCKER_CODE_MESSAGE = 'Wpisz kod paczkomatu.'
const HAS_SHIPMENT_MESSAGE = 'Zamówienie ma już przesyłkę.'
const PACKAGE_ORDERED_MESSAGE =
  'Paczka tej przesyłki jest już zamówiona w Furgonetce – utwórz przesyłkę ponownie albo anuluj paczkę w Furgonetce.'
const UNREACHABLE_MESSAGE =
  'Nie udało się sprawdzić paczki w Furgonetce – spróbuj ponownie za chwilę.'

/** What goes into the package; the pickup is not part of it – the batch decides that. */
type Plan = Pick<DraftInput, 'carrier' | 'receiver' | 'parcels' | 'declaredValueCents'>

const RECEIVER_KEYS: (keyof ShipmentReceiver)[] = [
  'name',
  'company',
  'phone',
  'email',
  'street',
  'postal_code',
  'city',
  'point',
  'point_label',
]
const PARCEL_KEYS: (keyof ParcelSpec)[] = [
  'template_id',
  'name',
  'kind',
  'length_cm',
  'width_cm',
  'height_cm',
  'weight_g',
]

const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : String((error as { message?: unknown } | null)?.message ?? error)

const moduleOf = (container: MedusaContainer) =>
  container.resolve<FurgonetkaModuleService>(FURGONETKA_MODULE)

/**
 * Checks a draft and returns it normalised: the phone as `+48…`, the locker code in capitals and
 * no point on a courier shipment. `bulky` – the order has a board or a „Tylko kurier” product,
 * which only DPD carries (spec 6d §5.2). Refusals are `ShipmentActionError`s.
 */
export function validateDraft(
  input: DraftInput,
  bulky: boolean | ((carrier: Carrier) => boolean),
): DraftInput {
  const refuse = (message: string): never => {
    throw new ShipmentActionError(message)
  }
  const refused =
    typeof bulky === 'function' ? bulky(input.carrier) : bulky && input.carrier !== 'dpd'
  if (refused) refuse(BULKY_MESSAGE)
  const { parcels } = input
  if (parcels.length < 1 || parcels.length > MAX_PARCELS) refuse(PARCEL_COUNT_MESSAGE)
  const whole = (value: number) => Number.isInteger(value) && value > 0
  const sized = (parcel: ParcelSpec) =>
    [parcel.length_cm, parcel.width_cm, parcel.height_cm, parcel.weight_g].every(whole)
  if (!parcels.every(sized)) refuse(DIMENSIONS_MESSAGE)
  if (input.carrier === 'dpd' && parcels.some((parcel) => parcel.weight_g > DPD_MAX_WEIGHT_G)) {
    refuse(DPD_WEIGHT_MESSAGE)
  }
  if (!Number.isInteger(input.declaredValueCents) || input.declaredValueCents < 0) {
    refuse(VALUE_MESSAGE)
  }

  const receiver = { ...input.receiver, phone: normalizePhone(input.receiver.phone) }
  if (input.carrier !== 'inpost_locker') {
    // A courier goes to the address; a point left from the locker order would mislead the e-mail.
    return { ...input, receiver: { ...receiver, point: null, point_label: null } }
  }
  if (parcels.length !== 1 || !LOCKER_KINDS.includes(parcels[0]?.kind ?? '')) {
    refuse(LOCKER_PARCEL_MESSAGE)
  }
  const point = normalizeLockerCode(receiver.point)
  if (!point) return refuse(LOCKER_CODE_MESSAGE)
  if (!isPolishMobile(receiver.phone)) refuse(MOBILE_FOR_LOCKER)
  return { ...input, receiver: { ...receiver, point } }
}

/**
 * Whether two plans make the same package: carrier, receiver, parcels and declared value, field by
 * field (a JSON column does not keep the key order; a missing field counts as `null`).
 */
export function samePlan(a: Plan, b: Plan): boolean {
  const same = <T>(x: T, y: T, keys: (keyof T)[]) =>
    keys.every((key) => (x[key] ?? null) === (y[key] ?? null))
  return (
    a.carrier === b.carrier &&
    a.declaredValueCents === b.declaredValueCents &&
    same(a.receiver, b.receiver, RECEIVER_KEYS) &&
    a.parcels.length === b.parcels.length &&
    a.parcels.every((parcel, index) => same(parcel, b.parcels[index] as ParcelSpec, PARCEL_KEYS))
  )
}

/** Whether the package an earlier attempt left is ordered (paid) or being ordered now. */
async function packagePaid(container: MedusaContainer, packageId: string): Promise<boolean> {
  const config = furgonetkaConfig(process.env)
  if (!config) throw new ShipmentActionError(PAGE_BLOCKERS.not_configured)
  try {
    const step = packageStep(await clientFor(container, config).getPackage(packageId))
    return step === 'ordered' || step === 'pending'
  } catch (error) {
    if (error instanceof FurgonetkaError && error.kind === 'not_found') return false
    // Not knowing is no reason to write the plan: the operator tries again.
    throw new ShipmentActionError(`${UNREACHABLE_MESSAGE} ${errorText(error)}`)
  }
}

/**
 * „Zapisz” in the card (spec 6d §5.5): the plan becomes the draft of the order's shipment. A
 * `draft` or `failed` row takes the new plan and turns `draft`, without a row one is made. The
 * Furgonetka identity of an earlier attempt (reference, package) stays with the row, so the next
 * creation finds that package. A package that is ordered goes out as it is, so the row of a paid
 * package keeps its plan: only the same plan (the card's retry) is taken.
 */
export async function saveDraft(
  container: MedusaContainer,
  orderId: string,
  input: DraftInput,
): Promise<ShipmentRow> {
  return lockShipment(container, orderId, async () => {
    const order = await loadShippingOrder(container, orderId)
    if (!order) throw new ShipmentActionError(NO_ORDER_MESSAGE)
    const shipments = moduleOf(container)
    const row = await shipments.activeShipment(orderId)
    const blocker = orderBlocker(order, row)
    if (blocker) throw new ShipmentActionError(blocker)
    // A new draft row would hide the kept package and let the order ship a second time.
    if (!row && keptPackage(await shipments.latestShipment(orderId))) {
      throw new ShipmentActionError(NOT_CANCELED_MESSAGE)
    }
    if (row?.state === 'creating') throw new ShipmentActionError(BUSY_MESSAGE)

    const settings = planSettings(container)
    const draft = validateDraft(input, (carrier) => classRefuses(order, carrier, settings))
    if (row?.package_id) {
      const current = {
        carrier: row.carrier,
        receiver: receiverOf(row),
        parcels: parcelsOf(row),
        declaredValueCents: row.declared_value_cents,
      }
      // The row and the e-mail would describe a parcel other than the one that is paid for.
      if (!samePlan(draft, current) && (await packagePaid(container, row.package_id))) {
        throw new ShipmentActionError(PACKAGE_ORDERED_MESSAGE)
      }
    }
    const values = {
      state: 'draft' as const,
      carrier: draft.carrier,
      receiver: asJson(draft.receiver),
      parcels: asJson(draft.parcels),
      declared_value_cents: draft.declaredValueCents,
      pickup: draft.pickup,
      last_error: null,
    }
    const saved = row
      ? await shipments.updateShipments({ id: row.id, ...values })
      : await shipments.createShipments({ order_id: orderId, ...values })
    return saved as ShipmentRow
  })
}

/**
 * The package a failed attempt left, before its row goes: an unordered one is deleted (it is
 * free); an ordered one is paid, so the row – the only record of it in the shop – stays.
 */
async function releasePackage(container: MedusaContainer, packageId: string): Promise<void> {
  const config = furgonetkaConfig(process.env)
  if (!config) throw new ShipmentActionError(PAGE_BLOCKERS.not_configured)
  const client = clientFor(container, config)
  let info: PackageInfo
  try {
    info = await client.getPackage(packageId)
  } catch (error) {
    if (error instanceof FurgonetkaError && error.kind === 'not_found') return
    throw new ShipmentActionError(errorText(error))
  }
  const step = packageStep(info)
  if (step === 'ordered' || step === 'pending') {
    throw new ShipmentActionError(PACKAGE_ORDERED_MESSAGE)
  }
  if (step === 'replace') {
    try {
      await client.deletePackage(packageId)
    } catch (error) {
      throw new ShipmentActionError(errorText(error))
    }
  }
}

/** „Przywróć podpowiedź” (spec 6d §5.5): the `draft` or `failed` row goes, the suggestion is back. */
export async function clearDraft(container: MedusaContainer, orderId: string): Promise<void> {
  await lockShipment(container, orderId, async () => {
    const shipments = moduleOf(container)
    const row = await shipments.activeShipment(orderId)
    if (!row) return
    if (row.state === 'creating') throw new ShipmentActionError(BUSY_MESSAGE)
    if (row.state !== 'draft' && row.state !== 'failed') {
      throw new ShipmentActionError(HAS_SHIPMENT_MESSAGE)
    }
    if (row.package_id) await releasePackage(container, row.package_id)
    await shipments.deleteShipments(row.id)
  })
}

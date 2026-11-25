import type {
  AdminShipmentResponse,
  AdminShipmentView,
  CardTemplate,
  PickupChoice,
  ShipmentState,
} from '../../lib/card-types'
import { onlyCarriersText } from '../../lib/carriers'
import { type PickupWindow, pickupText } from '../../lib/pickup'
import type { CreateResult, QueueRow } from '../../lib/queue-types'
import {
  CARRIER_NAMES,
  type Carrier,
  type HistoryEntry,
  NOT_CANCELED_MESSAGE,
  type ParcelSpec,
  type ShipmentPlan,
  type TemplateKind,
} from '../../types'
import { gramsFromKg, kgText, numberFromText, weightText } from './shipping-labels'

/** What the state column of a row needs from it. */
type StateFields = Pick<QueueRow, 'state' | 'pickup' | 'pickupStatus' | 'pickupWindow' | 'error'>

/** The state column of the „Do wysyłki” list (spec 6d §5.4). */
export function queueStateLabel(row: StateFields): string {
  if (row.state === 'new') return 'nowe'
  if (row.state === 'creating') return 'w tworzeniu'
  if (row.state === 'failed') return row.error ? `błąd: ${row.error}` : 'błąd'
  if (row.pickup === 'drop_off') return 'nadanie w punkcie'
  if (row.pickupStatus === 'ordered' && row.pickupWindow) {
    return `odbiór zamówiony na ${pickupText(row.pickupWindow)}`
  }
  if (row.pickupStatus === 'failed') return 'odbiór niezamówiony'
  return 'etykieta gotowa'
}

/** „Paczkomat InPost KRA01M”, „Kurier DPD (zmieniony)” – the carrier is not the customer's choice. */
export function deliveryLabel(row: Pick<QueueRow, 'delivery'>): string {
  const { carrier, lockerCode, changed } = row.delivery
  return [CARRIER_NAMES[carrier], lockerCode, changed ? '(zmieniony)' : null]
    .filter(Boolean)
    .join(' ')
}

/**
 * „Karton deski 15 kg”, „2 × Karton deski 15 kg”, „Karton deski 15 kg + Karton mały 3 kg”: equal
 * parcels (name, size, weight) are counted, groups keep the order of their first parcel.
 */
export function parcelsLabel(parcels: ParcelSpec[]): string {
  if (!parcels.length) return '–'
  const groups = new Map<string, { parcel: ParcelSpec; count: number }>()
  for (const parcel of parcels) {
    const key = [
      parcel.name,
      parcel.length_cm,
      parcel.width_cm,
      parcel.height_cm,
      parcel.weight_g,
    ].join('|')
    const group = groups.get(key)
    if (group) group.count += 1
    else groups.set(key, { parcel, count: 1 })
  }
  return [...groups.values()]
    .map(({ parcel, count }) => {
      const text = `${parcel.name} ${weightText(parcel.weight_g)}`
      return count > 1 ? `${count} × ${text}` : text
    })
    .join(' + ')
}

/** How the summary names a carrier: DPD alone is „DPD”, the InPost services keep their names. */
const SUMMARY_NAMES: Record<Carrier, string> = {
  dpd: 'DPD',
  inpost_courier: CARRIER_NAMES.inpost_courier,
  inpost_locker: CARRIER_NAMES.inpost_locker,
}

/** „DPD: 2, Paczkomat InPost: 1” – shipments per carrier, always in the same order. */
export function carrierSummary(rows: Pick<QueueRow, 'delivery'>[]): string {
  return (Object.keys(SUMMARY_NAMES) as Carrier[])
    .map((carrier) => ({
      carrier,
      count: rows.filter((row) => row.delivery.carrier === carrier).length,
    }))
    .filter(({ count }) => count > 0)
    .map(({ carrier, count }) => `${SUMMARY_NAMES[carrier]}: ${count}`)
    .join(', ')
}

/**
 * The outcome of one order (or one pickup) in its row after „Utwórz przesyłki” or „Zamów odbiór”.
 * A shipment whose label is ready can still have a pickup that was not ordered – that stays visible.
 */
export function resultLabel(result: CreateResult, kind: 'create' | 'pickup'): string {
  if (!result.ok) return result.message ? `błąd: ${result.message}` : 'błąd'
  if (kind === 'pickup') return 'odbiór zamówiony'
  return result.message
    ? `etykieta gotowa, odbiór niezamówiony: ${result.message}`
    : 'etykieta gotowa'
}

/** The toast after a batch: the kind and the text. */
export function batchToast(
  results: CreateResult[],
  kind: 'create' | 'pickup',
): { kind: 'success' | 'warning' | 'error'; text: string } {
  const total = results.length
  const done = results.filter((result) => result.ok).length
  // A shipment made without its pickup booked is done, but wants a look.
  const clean = results.filter((result) => result.ok && !result.message).length
  const what = kind === 'create' ? 'przesyłek' : 'odbiorów'
  if (done === 0) {
    return {
      kind: 'error',
      text: `Nie ${kind === 'create' ? 'utworzono żadnej przesyłki' : 'zamówiono żadnego odbioru'} – powody są w wierszach`,
    }
  }
  if (clean === total) {
    return {
      kind: 'success',
      text: kind === 'create' ? `Utworzono przesyłki: ${total}` : `Zamówiono odbiór: ${total}`,
    }
  }
  return {
    kind: 'warning',
    text: `${kind === 'create' ? 'Utworzono' : 'Zamówiono'} ${done} z ${total} ${what} – sprawdź wiersze z uwagami`,
  }
}

/** „1 zamówienie”, „3 zamówienia”, „12 zamówień” – the Polish plural of the header. */
export function ordersCount(count: number): string {
  const lastTwo = count % 100
  const last = count % 10
  if (count === 1) return '1 zamówienie'
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return `${count} zamówienia`
  return `${count} zamówień`
}

const DATE = new Intl.DateTimeFormat('pl-PL', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Warsaw',
})

/** „3 lis 2026, 10:15” – when the order was placed, in Warsaw time. */
export function orderDateText(iso: string): string {
  return DATE.format(new Date(iso))
}

// ---------------------------------------------------------------------------------------------
// The „Wysyłka” card of an order (spec 6d §5.5, §5.9)
// ---------------------------------------------------------------------------------------------

type WarningFields = Pick<AdminShipmentResponse, 'blockers' | 'order' | 'shipment' | 'actions'>

/** States from the first scan of the carrier on: the shop no longer cancels the shipment. */
const AT_CARRIER: string[] = ['in_transit', 'delivered', 'problem']

/**
 * The one warning on top of the card, `null` when there is none. The most specific cause comes
 * first: a package Furgonetka kept, a manual fulfillment, a canceled order that still has its
 * shipment, a shipment past the first scan, one being created – the blockers of the page last.
 */
export function cardWarning(card: WarningFields): string | null {
  const { order, shipment } = card
  if (shipment?.cancelError) return NOT_CANCELED_MESSAGE
  if (order.manualFulfillment) return 'Zrealizowane ręcznie – bez przesyłki Furgonetki'
  if (order.canceled && shipment && card.actions.cancel) {
    return 'Zamówienie anulowane – anuluj przesyłkę'
  }
  if (shipment && AT_CARRIER.includes(shipment.state)) {
    return 'Przesyłka jest już u przewoźnika – anulowanie tylko przez Furgonetkę'
  }
  if (shipment?.state === 'creating') {
    return 'Przesyłka jest właśnie tworzona – odśwież stronę za chwilę.'
  }
  return card.blockers.length ? card.blockers.join('. ') : null
}

/** „3 lis 2026, 10:15 – Odebrana”: the carrier's own words, the status when it gave none. */
export function historyLabel(entry: HistoryEntry): string {
  const text = entry.label?.trim() || entry.status
  // A time that does not parse must not stop the whole card from drawing.
  return Number.isNaN(Date.parse(entry.at)) ? text : `${orderDateText(entry.at)} – ${text}`
}

const STATE_LABELS: Record<ShipmentState, string> = {
  draft: 'szkic',
  creating: 'w tworzeniu',
  failed: 'błąd',
  ready: 'etykieta gotowa',
  in_transit: 'w drodze',
  delivered: 'doręczona',
  problem: 'problem z przesyłką',
  canceled: 'anulowana',
}

export function shipmentStateLabel(state: ShipmentState): string {
  return STATE_LABELS[state]
}

/** „śr 4 lis, 10:00–15:00”, „nadanie w punkcie”, or „niezamówiony” when the courier is not booked. */
export function pickupLine(
  shipment: Pick<AdminShipmentView, 'pickup' | 'pickupStatus' | 'pickupWindow'>,
): string {
  if (shipment.pickup === 'drop_off') return 'nadanie w punkcie'
  // A failed booking keeps the window that was asked for; it is no pickup.
  if (shipment.pickupStatus === 'ordered' && shipment.pickupWindow) {
    return pickupText(shipment.pickupWindow)
  }
  return 'niezamówiony'
}

/** The toast after the card created a shipment or ordered its pickup. */
export function cardToast(
  result: CreateResult,
  kind: 'create' | 'pickup',
): { kind: 'success' | 'warning' | 'error'; text: string } {
  if (!result.ok) {
    return {
      kind: 'error',
      text:
        result.message ??
        (kind === 'create'
          ? 'Nie udało się utworzyć przesyłki.'
          : 'Nie udało się zamówić odbioru.'),
    }
  }
  if (kind === 'pickup') return { kind: 'success', text: 'Zamówiono odbiór' }
  // The label is ready, but the pickup was not booked – that stays visible.
  return result.message
    ? { kind: 'warning', text: `Utworzono przesyłkę, odbiór niezamówiony: ${result.message}` }
    : { kind: 'success', text: 'Utworzono przesyłkę' }
}

/** Grosze as the text of the value input: „49,90”. */
export function zlInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

/** The złoty typed in the form (comma or dot, up to two decimals) as grosze; `null` for anything else. */
export function centsFromZl(text: string): number | null {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(text.trim())
  if (!match) return null
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
}

const LOCKER_KINDS: TemplateKind[] = ['locker_a', 'locker_b', 'locker_c']
const isLocker = (carrier: Carrier) => carrier === 'inpost_locker'

/** The parcel a template describes, as the shipment keeps it. */
export function templateParcel(template: CardTemplate): ParcelSpec {
  return {
    template_id: template.id,
    name: template.name,
    kind: template.kind,
    length_cm: template.length_cm,
    width_cm: template.width_cm,
    height_cm: template.height_cm,
    weight_g: template.weight_g,
  }
}

/** The templates a carrier takes: the sizes A, B and C for a parcel locker, the cartons for a courier. */
export function templatesFor(carrier: Carrier, templates: CardTemplate[]): CardTemplate[] {
  return templates.filter((template) => isLocker(carrier) === LOCKER_KINDS.includes(template.kind))
}

/** A parcel of the form: sizes and weight in the texts of the inputs (cm, kg). */
export interface FormParcel {
  template_id: string | null
  name: string
  kind: TemplateKind
  length: string
  width: string
  height: string
  weight: string
}

const formParcel = (parcel: ParcelSpec): FormParcel => ({
  template_id: parcel.template_id,
  name: parcel.name,
  kind: parcel.kind,
  length: String(parcel.length_cm),
  width: String(parcel.width_cm),
  height: String(parcel.height_cm),
  weight: kgText(parcel.weight_g),
})

/** The parcel of a chosen template, as the form holds it. */
export const formParcelOf = (template: CardTemplate): FormParcel =>
  formParcel(templateParcel(template))

/**
 * The form of the card. Every input holds a text; `formOf` writes the plan into them and `draftOf`
 * reads them back, so a field nobody touched goes back exactly as it came (the draft of a row with
 * a paid package is only taken when its plan is the same, spec 6d §5.5).
 */
export interface CardForm {
  carrier: Carrier
  phone: string
  street: string
  postalCode: string
  city: string
  point: string
  pointLabel: string
  parcels: FormParcel[]
  /** The declared value in złoty. */
  value: string
  way: 'courier' | 'drop_off'
}

export function formOf(plan: ShipmentPlan): CardForm {
  const { receiver } = plan
  return {
    carrier: plan.carrier,
    phone: receiver.phone,
    street: receiver.street ?? '',
    postalCode: receiver.postal_code ?? '',
    city: receiver.city ?? '',
    point: receiver.point ?? '',
    pointLabel: receiver.point_label ?? '',
    parcels: plan.parcels.map(formParcel),
    value: zlInput(plan.declaredValueCents),
    way: plan.pickup,
  }
}

/** The pickup window the operator picked for an order. */
export interface ChosenTerm {
  orderId: string
  term: PickupWindow
}

/**
 * The courier window the card shows and books with „Utwórz przesyłkę”: the one the operator picked
 * for this order, else the default. It is not part of the form or of the draft – the form starts
 * again from the plan whenever the plan changes on the server (after „Zapisz”, after a failed try),
 * and the window must outlive that, so the card keeps it beside the form.
 */
export function termOf(
  chosen: ChosenTerm | null,
  orderId: string,
  fallback: PickupWindow,
): PickupWindow {
  return chosen?.orderId === orderId ? chosen.term : fallback
}

/** A text that was not edited is the original, as it was; one that was is trimmed, empty is `null`. */
const edited = (text: string, original: string | null): string | null =>
  text === (original ?? '') ? original : text.trim() || null

function parcelOf(parcel: FormParcel): ParcelSpec | null {
  const length = numberFromText(parcel.length)
  const width = numberFromText(parcel.width)
  const height = numberFromText(parcel.height)
  const weight = gramsFromKg(parcel.weight)
  if (length === null || width === null || height === null || weight === null) return null
  return {
    template_id: parcel.template_id,
    name: parcel.name,
    kind: parcel.kind,
    length_cm: length,
    width_cm: width,
    height_cm: height,
    weight_g: weight,
  }
}

/**
 * The draft the form stands for: `plan` with what was edited changed. Only whether the numbers
 * can be read is checked here; their range is the server's to judge, with its own messages.
 */
export function draftOf(
  form: CardForm,
  plan: ShipmentPlan,
): { draft: ShipmentPlan } | { error: string } {
  const parcels = form.parcels.map(parcelOf)
  if (parcels.some((parcel) => parcel === null)) {
    return { error: 'Wymiary i waga paczki muszą być liczbami (waga w kg, np. 2,5).' }
  }
  const declaredValueCents = centsFromZl(form.value)
  if (declaredValueCents === null) return { error: 'Podaj wartość deklarowaną w zł, np. 49,90.' }
  const { receiver } = plan
  return {
    draft: {
      carrier: form.carrier,
      receiver: {
        ...receiver,
        phone: edited(form.phone, receiver.phone) ?? '',
        street: edited(form.street, receiver.street),
        postal_code: edited(form.postalCode, receiver.postal_code),
        city: edited(form.city, receiver.city),
        point: edited(form.point, receiver.point),
        point_label: edited(form.pointLabel, receiver.point_label),
      },
      parcels: parcels as ParcelSpec[],
      declaredValueCents,
      pickup: form.way,
    },
  }
}

/** How the parcels leave, as the creation asks for it. */
export function pickupOf(form: CardForm, term: PickupWindow): PickupChoice {
  return form.way === 'courier' ? { type: 'courier', ...term } : { type: 'drop_off' }
}

/** What is missing for a courier pickup; a drop-off needs no day. */
export function termProblem(form: CardForm, term: PickupWindow): string | null {
  if (form.way !== 'courier') return null
  const { date, from, to } = term
  return date && from && to && from < to
    ? null
    : 'Podaj dzień i godziny odbioru – początek przed końcem.'
}

/** The card's note under the carrier choice: the carriers the order's parcel classes allow. */
export function bulkyHint(allowed: Carrier[]): string {
  return `Ten produkt wysyłamy ${onlyCarriersText(allowed)}.`
}

/**
 * Another carrier. Between a parcel locker and a courier the parcels change: a locker takes one
 * locker size, a courier a carton – for a bulky item the carton of its class (`classPurpose`). The address and the
 * locker stay in the form, so changing back loses nothing.
 */
export function changeCarrier(
  form: CardForm,
  carrier: Carrier,
  templates: CardTemplate[],
  classPurpose: string | null,
): CardForm {
  if (isLocker(carrier) === isLocker(form.carrier)) return { ...form, carrier }
  const purpose = isLocker(carrier) ? 'accessories_locker' : (classPurpose ?? 'accessories_courier')
  const allowed = templatesFor(carrier, templates)
  const template = allowed.find((candidate) => candidate.purpose === purpose) ?? allowed[0]
  return { ...form, carrier, parcels: template ? [formParcelOf(template)] : [] }
}

/** „+ dodaj paczkę”: the accessories carton, else the first carton. A parcel locker has one parcel. */
export function addParcel(form: CardForm, templates: CardTemplate[]): CardForm {
  if (isLocker(form.carrier)) return form
  const allowed = templatesFor(form.carrier, templates)
  const template =
    allowed.find((candidate) => candidate.purpose === 'accessories_courier') ?? allowed[0]
  return template ? { ...form, parcels: [...form.parcels, formParcelOf(template)] } : form
}

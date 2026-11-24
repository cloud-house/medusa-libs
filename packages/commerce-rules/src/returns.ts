/** Fallback length of the return window (days) when the CMS setting `returnDays` is unavailable. */
export const RETURN_WINDOW_DAYS = 30

/** `shipping_option_type.code` of the return shipping option „Zwrot we własnym zakresie”. */
export const RETURN_OPTION_CODE = 'zwrot-wlasny'

/** Longest customer note on a return request. */
export const RETURN_NOTE_MAX = 500

/** Return reasons: `id` is the `return_reason.value` in Medusa, `label` what the customer sees. */
export const RETURN_REASONS = [
  { id: 'size', label: 'Niewłaściwy rozmiar' },
  { id: 'color', label: 'Inny kolor niż na zdjęciu' },
  { id: 'not_as_described', label: 'Towar niezgodny z opisem' },
  { id: 'defect', label: 'Wada / uszkodzenie' },
  { id: 'mind_changed', label: 'Rezygnacja bez podania przyczyny' },
] as const

export type ReturnReasonCode = (typeof RETURN_REASONS)[number]['id']

export function isReturnReasonCode(value: unknown): value is ReturnReasonCode {
  return RETURN_REASONS.some((reason) => reason.id === value)
}

/** The customer-facing label of a reason code; `null` for no or an unknown code. */
export function returnReasonLabel(code: string | null): string | null {
  return RETURN_REASONS.find((reason) => reason.id === code)?.label ?? null
}

/** Messages of the return flow, shared by the backend (errors) and the storefront (hints). */
export const RETURN_MESSAGES = {
  notShipped:
    'Zwrot zgłosisz, gdy wyślemy zamówienie. Jeśli chcesz z niego zrezygnować wcześniej, napisz do nas.',
  canceled: 'Zamówienie jest anulowane – nie ma czego zwracać.',
  nothingLeft: 'Wszystkie produkty z tego zamówienia są już zgłoszone do zwrotu.',
  quantity:
    'Tych produktów nie można już zwrócić w takiej ilości – odśwież stronę i sprawdź ilości.',
  reason: 'Wybierz powód zwrotu z listy.',
  guestNotFound: 'Nie znaleźliśmy zamówienia o tym numerze z tym adresem e-mail.',
  busy: 'Zgłoszenie do tego zamówienia jest właśnie zapisywane – spróbuj za chwilę.',
} as const

/** Why the window is closed, with the length from the `returnDays` setting. */
export function returnExpiredMessage(days: number): string {
  return `Minął termin na zwrot towaru (${days} dni od otrzymania paczki)`
}

/** Medusa return statuses the customer sees; the admin's draft (`open`) is not one of them. */
export type ReturnStatusKey = 'requested' | 'partially_received' | 'received' | 'canceled'

const RETURN_STATUS_KEYS: readonly string[] = [
  'requested',
  'partially_received',
  'received',
  'canceled',
]

/** `open` (a draft in the admin panel) and unknown statuses give `null`. */
export function returnStatusKey(status: string): ReturnStatusKey | null {
  return RETURN_STATUS_KEYS.includes(status) ? (status as ReturnStatusKey) : null
}

export const RETURN_STATUS_LABELS: Record<ReturnStatusKey, string> = {
  requested: 'Zgłoszony – czekamy na paczkę',
  partially_received: 'Przyjęty częściowo',
  received: 'Paczka przyjęta',
  canceled: 'Anulowany',
}

/** The dates of one fulfillment that decide when the return window opens. */
export interface ReturnWindowFulfillment {
  shippedAt: Date | string | null
  deliveredAt: Date | string | null
  canceledAt: Date | string | null
}

export interface ReturnWindowStart {
  /** `delivered` – the goods were received, `shipped` – only the dispatch date is known. */
  source: 'delivered' | 'shipped'
  at: Date
}

function toDate(value: Date | string | null): Date | null {
  if (value === null) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * The window opens when the customer RECEIVES the goods (Regulamin §8): per fulfillment the
 * delivery date, else the dispatch date. Of several fulfillments (not canceled, already shipped)
 * the latest start counts – the contract covers goods delivered separately, so the term runs from
 * the last one. `null` while nothing has been shipped.
 */
export function returnWindowStart(
  fulfillments: ReturnWindowFulfillment[],
): ReturnWindowStart | null {
  let best: ReturnWindowStart | null = null
  for (const fulfillment of fulfillments) {
    if (fulfillment.canceledAt) continue
    const shipped = toDate(fulfillment.shippedAt)
    if (!shipped) continue
    const delivered = toDate(fulfillment.deliveredAt)
    const candidate: ReturnWindowStart = delivered
      ? { source: 'delivered', at: delivered }
      : { source: 'shipped', at: shipped }
    if (!best || candidate.at.getTime() > best.at.getTime()) best = candidate
  }
  return best
}

const WARSAW_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' })

/** The calendar day of the moment in `Europe/Warsaw`, `YYYY-MM-DD`. */
export function warsawDay(value: Date): string {
  return WARSAW_DAY.format(value)
}

/**
 * The last day a return can still be requested: the start day in Warsaw plus `days` calendar days
 * (the start day itself does not count, the last day does). Plain date arithmetic in UTC, so the
 * clock change never shifts it.
 */
export function returnLastDay(start: Date, days: number): string {
  const [year = 0, month = 1, day = 1] = warsawDay(start).split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

export interface ReturnEligibilityInput {
  start: ReturnWindowStart | null
  days: number
  now: Date
  canceled: boolean
}

/** A return can be requested until the end of the last day (Warsaw time) of the window. */
export function isReturnEligible(input: ReturnEligibilityInput): boolean {
  return (
    !input.canceled &&
    input.start !== null &&
    warsawDay(input.now) <= returnLastDay(input.start.at, input.days)
  )
}

/** Quantities of one order item, from Medusa's `detail` (`shipped_quantity`, `return_*_quantity`). */
export interface ReturnQuantities {
  quantity: number
  shipped: number
  requested: number
  received: number
  dismissed: number
}

/** How many pieces of the item can still be returned – never negative. */
export function returnableQuantity(q: ReturnQuantities): number {
  return Math.max(0, q.shipped - q.requested - q.received - q.dismissed)
}

/** One line of a return request. */
export interface ReturnLine {
  item_id: string
  title: string
  variant: string | null
  quantity: number
  reason: ReturnReasonCode | null
}

/** A return the customer requested; the admin's drafts (`open`) are not shown. */
export interface AccountReturn {
  id: string
  display_id: number
  status: ReturnStatusKey
  requested_at: string | null
  items: ReturnLine[]
}

/** An order item that can still be returned (`returnable` > 0 pieces). */
export interface ReturnableItem {
  id: string
  title: string
  variant: string | null
  thumbnail: string | null
  returnable: number
}

/** What the customer may return from an order, and the returns already requested. */
export interface ReturnInfo {
  eligible: boolean
  /** The reason when `!eligible`. */
  blocked: string | null
  window: {
    source: 'delivered' | 'shipped'
    started_at: string
    /** `YYYY-MM-DD`, Europe/Warsaw – the last day a return can be requested. */
    last_day: string
    days: number
  } | null
  /** Only items with `returnable` > 0. */
  items: ReturnableItem[]
  /** Newest first, without `open` drafts. */
  returns: AccountReturn[]
}

/** One item of a return request: which order item, how many pieces and why. */
export interface ReturnClaimItemInput {
  id: string
  quantity: number
  reason: ReturnReasonCode
}

/** `POST /store/returns/lookup` – a guest's order found by number and e-mail. */
export interface ReturnLookupResponse {
  display_id: number
  returns: ReturnInfo
}

/** `POST /store/returns/claim` – the return that was created. */
export interface ReturnClaimResponse {
  display_id: number
  return: AccountReturn
}

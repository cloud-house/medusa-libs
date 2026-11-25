import { createHash } from 'node:crypto'
import type { Carrier, ParcelSpec, ShipmentReceiver } from '../types'
import { FurgonetkaError, NO_FUNDS_MESSAGE } from './api-errors'
import { trackingUrl } from './carriers'
import type { FurgonetkaClient, PackageInfo, PackageInput, Sender, TokenSet } from './client'
import { FAKE_WEBHOOK_TOKEN } from './config'
import { sampleLabels } from './label-pdf'

/**
 * What a test can make the fake do wrong, once each:
 * - `no_funds` – the next `orderPackages` throws `no_funds` (a balance too low, nothing is ordered);
 * - `partial_funds` – the balance of the next `orderPackages` runs out before its last package: the
 *   others are ordered (and paid) and the command ends `partial_success` with the balance error, as
 *   the real client returns it (with one package nothing is ordered: `no_funds` is thrown);
 * - `transient` – the next `createPackage` fails with HTTP 503;
 * - `validation` – the next `createPackage` is refused for a field error;
 * - `lost` – the next `orderPackages` orders the packages, then throws a timeout;
 * - `pickup` – the next `orderPickup` is refused for all packages;
 * - `refresh` – the next `refreshTokens` fails with `auth`;
 * - `cancel` – the next `cancelPackages` cancels nothing.
 */
export type FakeFailure =
  | 'no_funds'
  | 'partial_funds'
  | 'transient'
  | 'validation'
  | 'lost'
  | 'pickup'
  | 'refresh'
  | 'cancel'

/** One tracking event of a fake package. */
export interface FakeEvent {
  /** The API's tracking state: `collected`, `delivered`, `returned`. */
  state: string
  /** The carrier's status text. */
  status: string
  branch: string
  /** ISO time. */
  at: string
}

export interface FakePackage {
  id: string
  reference: string | null
  serviceId: number
  carrier: Carrier
  /** `waiting` until ordered, `ordered`, `cancelled`. */
  state: 'waiting' | 'ordered' | 'cancelled'
  receiver: ShipmentReceiver
  sender: Sender
  parcels: ParcelSpec[]
  declaredValueCents: number
  pickup: 'courier' | 'drop_off'
  /** One carrier number per parcel, empty until ordered. */
  numbers: string[]
  costCents: number
  /** The courier pickup this package is in. */
  pickupId: string | null
  /** The carrier has scanned it – it can no longer be cancelled. */
  pickedUp: boolean
  events: FakeEvent[]
}

export interface FakePickup {
  id: string
  packageIds: string[]
  date: string
  from: string
  to: string
}

/** State of the in-process fake (spec 6d §5.12) – tests steer it, dev and E2E use it as is. */
export interface FakeState {
  packages: FakePackage[]
  pickups: FakePickup[]
  /** Ids of the order commands that ran. */
  commands: string[]
  failures: FakeFailure[]
  failNext(kind: FakeFailure): void
  /** Counter behind package ids, pickup ids, carrier numbers and tokens. */
  sequence: number
  reset(): void
}

const STATE_KEY = '__furgonetkaFake'

function createState(): FakeState {
  const state: FakeState = {
    packages: [],
    pickups: [],
    commands: [],
    failures: [],
    failNext(kind) {
      state.failures.push(kind)
    },
    sequence: 0,
    reset() {
      state.packages = []
      state.pickups = []
      state.commands = []
      state.failures = []
      state.sequence = 0
    },
  }
  return state
}

/**
 * One state per process, on `globalThis` – the Medusa app and the test file that steers it may
 * load this module through different module registries.
 */
export function fakeFurgonetka(): FakeState {
  const holder = globalThis as typeof globalThis & { [STATE_KEY]?: FakeState }
  holder[STATE_KEY] ??= createState()
  return holder[STATE_KEY]
}

/** Uses up a failure of this kind, if a test asked for one. */
function take(state: FakeState, kind: FakeFailure): boolean {
  const index = state.failures.indexOf(kind)
  if (index < 0) return false
  state.failures.splice(index, 1)
  return true
}

const next = (state: FakeState) => ++state.sequence

/** Per parcel, in grosze. */
const UNIT_COST: Record<Carrier, number> = { dpd: 1899, inpost_courier: 1599, inpost_locker: 1199 }

/** DPD `0000` + 10 digits + `U`, InPost 24 digits. */
function carrierNumber(carrier: Carrier, serial: number): string {
  return carrier === 'dpd'
    ? `0000${String(4_100_000_000 + serial)}U`
    : `6290${String(serial).padStart(20, '0')}`
}

/** InPost Kurier and Paczkomaty are one carrier for a pickup. */
const family = (carrier: Carrier) => (carrier === 'dpd' ? 'dpd' : 'inpost')

const EVENT_TEXT: Record<string, string> = {
  collected: 'Przesyłka odebrana od nadawcy',
  delivered: 'Przesyłka doręczona',
  returned: 'Przesyłka zwrócona do nadawcy',
}

function addEvent(pkg: FakePackage, trackingState: string): void {
  // Strictly later than the last event, so the order survives a fast test.
  const last = Date.parse(pkg.events[pkg.events.length - 1]?.at ?? '') || 0
  pkg.events.push({
    state: trackingState,
    status: EVENT_TEXT[trackingState] ?? trackingState,
    branch: 'Atrapa',
    at: new Date(Math.max(Date.now(), last + 1)).toISOString(),
  })
  pkg.pickedUp = true
}

function mustFind(state: FakeState, packageId: string): FakePackage {
  const pkg = state.packages.find((row) => row.id === packageId && row.state === 'ordered')
  if (!pkg) throw new Error(`Atrapa: nie ma zamówionej paczki ${packageId}.`)
  return pkg
}

/** The carrier picked the package up (first scan): it can no longer be cancelled. */
export function markPickedUp(packageId: string, state: FakeState = fakeFurgonetka()): void {
  addEvent(mustFind(state, packageId), 'collected')
}

export function markDelivered(packageId: string, state: FakeState = fakeFurgonetka()): void {
  addEvent(mustFind(state, packageId), 'delivered')
}

/** The package goes back to the sender. */
export function markReturned(packageId: string, state: FakeState = fakeFurgonetka()): void {
  addEvent(mustFind(state, packageId), 'returned')
}

/**
 * A webhook body of Furgonetka for the latest event of this tracking state (made up when the
 * package has none), signed for the token `atrapa`:
 * `md5(package_id package_no partner_order_id state description datetime branch token)`.
 */
export function webhookBody(
  packageId: string,
  trackingState: string,
  state: FakeState = fakeFurgonetka(),
) {
  const pkg = state.packages.find((row) => row.id === packageId)
  if (!pkg) throw new Error(`Atrapa: nie ma paczki ${packageId}.`)
  const event = [...pkg.events].reverse().find((row) => row.state === trackingState) ?? {
    state: trackingState,
    status: EVENT_TEXT[trackingState] ?? trackingState,
    branch: 'Atrapa',
    at: new Date().toISOString(),
  }
  const tracking = {
    // Furgonetka sends `YYYY-MM-DD HH:MM:SS`.
    datetime: event.at.slice(0, 19).replace('T', ' '),
    state: event.state,
    description: event.status,
    branch: event.branch,
  }
  const packageNo = pkg.numbers[0] ?? ''
  const partnerOrderId = pkg.reference ?? ''
  const control = createHash('md5')
    .update(
      `${pkg.id}${packageNo}${partnerOrderId}${tracking.state}${tracking.description}${tracking.datetime}${tracking.branch}${FAKE_WEBHOOK_TOKEN}`,
    )
    .digest('hex')
  return {
    package_id: Number(pkg.id),
    package_no: packageNo,
    partner_order_id: partnerOrderId,
    tracking,
    control,
  }
}

/** Tokens of the fake: the login always works, a refresh fails after `failNext('refresh')`. */
export function fakeTokens(kind: 'connect' | 'refresh'): TokenSet {
  const state = fakeFurgonetka()
  if (kind === 'refresh' && take(state, 'refresh')) {
    throw new FurgonetkaError(
      'auth',
      'Atrapa: Furgonetka odrzuciła token odświeżający (invalid_grant).',
      400,
    )
  }
  const serial = next(state)
  return {
    accessToken: `atrapa-access-${serial}`,
    refreshToken: `atrapa-refresh-${serial}`,
    accessExpiresAt: new Date(Date.now() + 31 * 24 * 3600 * 1000),
  }
}

const SERVICES = [
  { id: 1001, service: 'dpd', owner: 'furgonetka' as const },
  { id: 1002, service: 'inpostkurier', owner: 'furgonetka' as const },
  { id: 1003, service: 'inpost', owner: 'furgonetka' as const },
]

/** A fake Furgonetka account in memory: packages, commands, labels, pickups and scans. */
export function createFakeClient(state: FakeState = fakeFurgonetka()): FurgonetkaClient {
  const find = (packageId: string) => state.packages.find((row) => row.id === packageId)

  const get = (packageId: string) => {
    const pkg = find(packageId)
    if (!pkg) throw new FurgonetkaError('not_found', `Atrapa: nie ma paczki ${packageId}.`, 404)
    return pkg
  }

  const info = (pkg: FakePackage): PackageInfo => ({
    packageId: pkg.id,
    state: pkg.state,
    reference: pkg.reference,
    tracking: pkg.numbers.map((number) => ({ number, url: trackingUrl(pkg.carrier, number) })),
    costCents: pkg.costCents,
    cancelAvailable: pkg.state === 'ordered' && !pkg.pickedUp,
    pickupAvailable: pkg.state === 'ordered' && !pkg.pickedUp && pkg.pickupId === null,
  })

  return {
    async services() {
      return SERVICES.map((service) => ({ ...service }))
    },

    async account() {
      return { label: 'Atrapa Furgonetki' }
    },

    async createPackage(input: PackageInput) {
      if (take(state, 'transient')) {
        throw new FurgonetkaError('transient', 'Atrapa: Furgonetka nie odpowiada (HTTP 503).', 503)
      }
      if (take(state, 'validation')) {
        throw new FurgonetkaError(
          'permanent',
          '/receiver/postcode: Nieprawidłowy kod pocztowy',
          400,
        )
      }
      const id = String(100_000 + next(state))
      state.packages.push({
        id,
        reference: input.reference,
        serviceId: input.serviceId,
        carrier: input.carrier,
        state: 'waiting',
        receiver: structuredClone(input.receiver),
        sender: structuredClone(input.sender),
        parcels: structuredClone(input.parcels),
        declaredValueCents: input.declaredValueCents,
        pickup: input.pickup,
        numbers: [],
        costCents: UNIT_COST[input.carrier] * input.parcels.length,
        pickupId: null,
        pickedUp: false,
        events: [],
      })
      return { packageId: id }
    },

    async deletePackage(packageId) {
      const pkg = find(packageId)
      if (!pkg) return
      if (pkg.state !== 'waiting') {
        throw new FurgonetkaError(
          'permanent',
          'Atrapa: paczka jest zamówiona – anuluj ją zamiast usuwać.',
          400,
        )
      }
      state.packages = state.packages.filter((row) => row !== pkg)
    },

    async getPackage(packageId) {
      return info(get(packageId))
    },

    async findPackage(reference) {
      const pkg = state.packages.find(
        (row) => row.reference === reference && row.state !== 'cancelled',
      )
      return pkg ? info(pkg) : null
    },

    async orderPackages(commandId, packageIds) {
      // A command id that already ran is not run again: the real API answers the repeated PUT with
      // 400 `commandExists` and the client polls the existing command, so the caller sees its outcome.
      if (state.commands.includes(commandId)) {
        return {
          status: 'successful',
          ordered: packageIds.filter((id) => find(id)?.state === 'ordered'),
          errors: [],
        }
      }
      // The real API answers a balance too low with an HTTP 400 that the client throws.
      if (take(state, 'no_funds')) throw new FurgonetkaError('no_funds', NO_FUNDS_MESSAGE, 400)
      // The balance pays for every package but the last one; with one package, for none.
      const short = take(state, 'partial_funds')
      if (short && packageIds.length < 2) throw new FurgonetkaError('no_funds', NO_FUNDS_MESSAGE)
      const affordable = short ? packageIds.slice(0, -1) : packageIds
      const ordered: string[] = []
      const errors: { packageId: string | null; message: string; code: string | null }[] = []
      for (const packageId of affordable) {
        const pkg = find(packageId)
        if (pkg?.state !== 'waiting') {
          errors.push({
            packageId,
            message: pkg
              ? `Atrapa: paczka ${packageId} jest już zamówiona albo anulowana.`
              : `Atrapa: nie ma paczki ${packageId}.`,
            code: 'carrierValidationError',
          })
          continue
        }
        pkg.numbers = pkg.parcels.map(() => carrierNumber(pkg.carrier, next(state)))
        pkg.state = 'ordered'
        ordered.push(packageId)
      }
      // The real API names no package for the balance (`path: '/packages'`).
      if (short) errors.push({ packageId: null, message: NO_FUNDS_MESSAGE, code: null })
      state.commands.push(commandId)
      if (take(state, 'lost')) {
        throw new FurgonetkaError('transient', 'Atrapa: Furgonetka nie odpowiedziała w 30 s.')
      }
      return {
        status: errors.length ? (ordered.length ? 'partial_success' : 'error') : 'successful',
        ordered,
        errors,
      }
    },

    async label(packageId) {
      const pkg = get(packageId)
      if (pkg.state !== 'ordered') {
        throw new FurgonetkaError(
          'transient',
          'Etykieta jeszcze nie jest gotowa – spróbuj za chwilę.',
          204,
        )
      }
      return sampleLabels(pkg.numbers)
    },

    async labels(packageIds) {
      const numbers = packageIds.flatMap((packageId) => {
        const pkg = find(packageId)
        if (pkg?.state !== 'ordered') {
          throw new FurgonetkaError(
            'permanent',
            `Atrapa: paczka ${packageId} nie ma etykiety.`,
            400,
          )
        }
        return pkg.numbers
      })
      return sampleLabels(numbers)
    },

    async orderPickup(packageIds, window) {
      if (packageIds.length && take(state, 'pickup')) {
        return {
          ordered: [],
          failed: packageIds.map((packageId) => ({
            packageId,
            message: 'Atrapa: przewoźnik odmówił zamówienia odbioru.',
          })),
        }
      }
      const failed: { packageId: string; message: string }[] = []
      const groups = new Map<string, FakePackage[]>()
      for (const packageId of packageIds) {
        const pkg = find(packageId)
        if (pkg?.state !== 'ordered') {
          failed.push({ packageId, message: `Atrapa: paczka ${packageId} nie jest zamówiona.` })
        } else if (pkg.pickedUp) {
          failed.push({ packageId, message: `Atrapa: paczka ${packageId} jest już u przewoźnika.` })
        } else if (pkg.pickupId) {
          failed.push({
            packageId,
            message: `Atrapa: odbiór paczki ${packageId} jest już zamówiony.`,
          })
        } else {
          groups.set(family(pkg.carrier), [...(groups.get(family(pkg.carrier)) ?? []), pkg])
        }
      }
      // Furgonetka groups the packages by carrier: one pickup for each.
      const ordered: { packageId: string; pickupId: string; from: string; to: string }[] = []
      for (const group of groups.values()) {
        const pickup: FakePickup = {
          id: `NR${next(state)}`,
          packageIds: group.map((pkg) => pkg.id),
          date: window.date,
          from: window.from,
          to: window.to,
        }
        state.pickups.push(pickup)
        for (const pkg of group) {
          pkg.pickupId = pickup.id
          ordered.push({
            packageId: pkg.id,
            pickupId: pickup.id,
            from: window.from,
            to: window.to,
          })
        }
      }
      return { ordered, failed }
    },

    async cancelPackages(packageIds) {
      const refused = take(state, 'cancel')
      return packageIds.map((packageId) => {
        const pkg = find(packageId)
        // Only an ordered package the carrier has not scanned is cancelled. One cancelled already
        // (in Furgonetka's own panel, say) is refused too – most likely what the live API does.
        if (!pkg || refused || pkg.state !== 'ordered' || pkg.pickedUp) {
          return { packageId, ok: false }
        }
        pkg.state = 'cancelled'
        return { packageId, ok: true }
      })
    },

    async tracking(packageId) {
      return get(packageId).events.map((event) => ({
        state: event.state,
        at: event.at,
        label: event.status,
      }))
    },
  }
}

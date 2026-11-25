import { randomUUID } from 'node:crypto'
import type { Carrier, ParcelSpec, ShipmentReceiver } from '../types'
import { FurgonetkaError, type FurgonetkaErrorKind, NO_FUNDS_MESSAGE } from './api-errors'
import type { FurgonetkaConfig } from './config'
// Only for `config.client === 'fake'` (OAuth of the in-process fake); `config` never selects it in production.
import { fakeTokens } from './fake'
import { type PickupWindow, pickupText } from './pickup'

const TERMS_MESSAGE = 'Zaakceptuj regulaminy przewoźników w panelu Furgonetki i spróbuj ponownie.'

// The error type lives in `errors.ts` so the fake can use it without importing this module back.
export { FurgonetkaError, type FurgonetkaErrorKind, NO_FUNDS_MESSAGE }

/** Where the label of the shipment is sent from – the warehouse (spec 6d §5.1). */
export interface Sender {
  name: string
  street: string
  postal_code: string
  city: string
  phone: string
  email: string | null
}

export interface PackageInput {
  /** `user_reference_number` – the order number, the key to find the package again. */
  reference: string
  serviceId: number
  carrier: Carrier
  receiver: ShipmentReceiver
  sender: Sender
  parcels: ParcelSpec[]
  declaredValueCents: number
  /** `courier` – the courier collects at the sender; `drop_off` – the sender takes it to a point. */
  pickup: 'courier' | 'drop_off'
}

export type CommandStatus = 'successful' | 'partial_success' | 'error'

export interface PackageInfo {
  packageId: string
  /** The API's `state`: `waiting`, `ordered`, `cancelled`… */
  state: string
  reference: string | null
  /** One entry per parcel that already has a number. */
  tracking: { number: string; url: string | null }[]
  costCents: number | null
  cancelAvailable: boolean
  pickupAvailable: boolean
}

export interface OrderResult {
  status: CommandStatus
  ordered: string[]
  /** `packageId` is `null` for an error that names no package. */
  errors: { packageId: string | null; message: string; code: string | null }[]
}

export interface PickupResult {
  ordered: { packageId: string; pickupId: string; from: string; to: string }[]
  failed: { packageId: string; message: string }[]
}

/** One carrier scan; `state` is the API's tracking state (`collected`, `transit`, `canceled`…). */
export interface TrackingEvent {
  state: string
  at: string
  label: string | null
}

export interface FurgonetkaService {
  id: number
  /** The API's carrier key: `dpd`, `inpostkurier`, `inpost`… */
  service: string
  owner: 'furgonetka' | 'client'
}

export interface TokenSet {
  accessToken: string
  refreshToken: string
  accessExpiresAt: Date
}

export interface FurgonetkaClient {
  services(): Promise<FurgonetkaService[]>
  /** A name for the connected account: the current company, else the owner's e-mail. */
  account(): Promise<{ label: string }>
  createPackage(input: PackageInput): Promise<{ packageId: string }>
  /** Deletes an unordered package; a package that is already gone counts as deleted. */
  deletePackage(packageId: string): Promise<void>
  getPackage(packageId: string): Promise<PackageInfo>
  /** The package with exactly this `user_reference_number`, cancelled ones left out. */
  findPackage(reference: string): Promise<PackageInfo | null>
  /**
   * Orders (and pays for) the packages and waits for the result. A carrier's refusal of a package
   * comes back in `errors`, and so does a balance that ran out after some packages were ordered
   * (`partial_success`, an error without a package); a balance too low for any package, an
   * unreachable carrier, an error of the whole command and a command that does not finish in time
   * are thrown.
   */
  orderPackages(commandId: string, packageIds: string[]): Promise<OrderResult>
  label(packageId: string): Promise<Buffer>
  labels(packageIds: string[]): Promise<Buffer>
  /**
   * Books the courier pickup, one command per term. A package without a free term, or in a group
   * whose command failed, lands in `failed`; the call throws only when no pickup was booked at all.
   */
  orderPickup(packageIds: string[], window: PickupWindow): Promise<PickupResult>
  cancelPackages(packageIds: string[]): Promise<{ packageId: string; ok: boolean }[]>
  /** The scans of all parcels of the package, oldest first. */
  tracking(packageId: string): Promise<TrackingEvent[]>
}

// ---------------------------------------------------------------------------------------------
// Request body
// ---------------------------------------------------------------------------------------------

/** The `POST /packages` body (v2) for a shipment. Pure, so the tests can pin the shape. */
export function toPackageBody(input: PackageInput): Record<string, unknown> {
  const { receiver, sender } = input
  const to: Record<string, unknown> = { name: receiver.name }
  if (receiver.company) to.company = receiver.company
  if (input.carrier === 'inpost_locker') {
    // A parcel locker is a point, the address stays out.
    to.point = receiver.point
  } else {
    to.street = receiver.street
    to.postcode = receiver.postal_code
    to.city = receiver.city
  }
  to.country_code = 'PL'
  if (receiver.email) to.email = receiver.email
  to.phone = receiver.phone

  const pickup: Record<string, unknown> = {
    name: sender.name,
    street: sender.street,
    postcode: sender.postal_code,
    city: sender.city,
    country_code: 'PL',
    phone: sender.phone,
  }
  if (sender.email) pickup.email = sender.email
  // Dropping the parcel off: any point of the carrier will do.
  if (input.pickup === 'drop_off')
    pickup.point = input.carrier === 'dpd' ? 'any_parcel_shop' : 'any_apm'

  // The declared value is split evenly, the odd grosze go to the first parcel.
  const count = Math.max(input.parcels.length, 1)
  const share = Math.floor(input.declaredValueCents / count)
  const rest = input.declaredValueCents - share * count
  const parcels = input.parcels.map((parcel, index) => ({
    width: parcel.width_cm,
    depth: parcel.length_cm,
    height: parcel.height_cm,
    weight: parcel.weight_g / 1000,
    value: (share + (index === 0 ? rest : 0)) / 100,
    type: 'package',
  }))

  return {
    service_id: input.serviceId,
    user_reference_number: input.reference,
    receiver: to,
    pickup,
    parcels,
  }
}

// ---------------------------------------------------------------------------------------------
// Responses and errors
// ---------------------------------------------------------------------------------------------

type Obj = Record<string, unknown>

const isObj = (value: unknown): value is Obj =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const objects = (value: unknown): Obj[] => (Array.isArray(value) ? value.filter(isObj) : [])
const text = (value: unknown) => (typeof value === 'string' && value ? value : null)

const TRANSIENT_STATUSES = new Set([408, 429])
const BALANCE = /sald|środk|srodk|balance|funds/i

interface ApiError {
  path: string | null
  message: string
  code: string | null
}

function apiErrors(value: unknown): ApiError[] {
  return objects(value).map((row) => ({
    path: text(row.path),
    message: text(row.message) ?? '',
    code: text(row.code),
  }))
}

/** „/receiver/postcode: komunikat; …” – the errors of the API as one line. */
function flatten(errors: ApiError[]): string {
  return errors
    .map((error) => (error.path ? `${error.path}: ${error.message}` : error.message))
    .filter(Boolean)
    .join('; ')
}

/** Furgonetka answers a balance too low to an order with an error on `/packages` and no code. */
const isBalanceError = (error: ApiError) =>
  error.path === '/packages' && BALANCE.test(error.message)
const isNoFunds = (errors: ApiError[]) => errors.some(isBalanceError)

/** The id in `/packages/id/{id}`, `null` for any other path. */
const packageOf = (path: string | null) => /^\/packages\/id\/([^/]+)$/.exec(path ?? '')?.[1] ?? null

/** Hides secrets (the access token, the application secret…) from a text. */
function redactor(secrets: (string | undefined)[]) {
  const list = secrets.filter((secret): secret is string => Boolean(secret))
  return (value: string) => list.reduce((acc, secret) => acc.split(secret).join('***'), value)
}

type Redact = (value: string) => string

function networkError(error: unknown, timeoutMs: number, redact: Redact): FurgonetkaError {
  const name = (error as { name?: string } | null)?.name
  if (name === 'TimeoutError' || name === 'AbortError') {
    return new FurgonetkaError(
      'transient',
      `Furgonetka nie odpowiedziała w ${Math.ceil(timeoutMs / 1000)} s.`,
    )
  }
  const reason = error instanceof Error ? error.message : String(error)
  return new FurgonetkaError('transient', redact(`Brak połączenia z Furgonetką: ${reason}`))
}

async function httpError(response: Response, redact: Redact): Promise<FurgonetkaError> {
  const raw = await response.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    parsed = undefined
  }
  const body: Obj = isObj(parsed) ? parsed : {}
  const status = response.status
  const errors = apiErrors(body.errors)
  // Flat errors (401, 409, the token endpoint) carry `code`/`error` and `message`/`hint`.
  const code = text(body.code) ?? text(body.error)
  if (status >= 500 || TRANSIENT_STATUSES.has(status)) {
    return new FurgonetkaError('transient', `Furgonetka nie odpowiada (HTTP ${status}).`, status)
  }
  if (status === 401 || code === 'invalid_grant' || code === 'invalid_client') {
    return new FurgonetkaError(
      'auth',
      'Furgonetka odrzuciła autoryzację – połącz konto ponownie w Settings → Wysyłka.',
      status,
    )
  }
  if (status === 404)
    return new FurgonetkaError('not_found', 'Nie znaleziono w Furgonetce (HTTP 404).', 404)
  if (status === 409 && code === 'terms_and_conditions_not_valid') {
    return new FurgonetkaError('terms', TERMS_MESSAGE, status)
  }
  if (isNoFunds(errors)) return new FurgonetkaError('no_funds', NO_FUNDS_MESSAGE, status)
  const detail =
    flatten(errors) || text(body.message) || text(body.error_description) || text(body.hint)
  return new FurgonetkaError(
    'permanent',
    redact(detail ?? `Furgonetka odrzuciła żądanie (HTTP ${status}).`),
    status,
  )
}

/** The body of a response that stays readable for the caller; `undefined` when it is not JSON. */
async function peekJson(response: Response): Promise<unknown> {
  try {
    return await response.clone().json()
  } catch {
    return undefined
  }
}

/** Furgonetka answers a repeated command id with `commandExists`, flat or in `errors`. */
function isCommandExists(body: unknown): boolean {
  if (!isObj(body)) return false
  return (
    body.code === 'commandExists' || apiErrors(body.errors).some((e) => e.code === 'commandExists')
  )
}

async function readJson(response: Response): Promise<Obj> {
  try {
    const body: unknown = await response.json()
    return isObj(body) ? body : {}
  } catch {
    throw new FurgonetkaError(
      'transient',
      'Furgonetka odpowiedziała nieczytelnie.',
      response.status,
    )
  }
}

function toInfo(row: Obj): PackageInfo {
  const price = isObj(row.pricing) ? row.pricing.price_gross : null
  const cents = price === null || price === undefined ? NaN : Math.round(Number(price) * 100)
  return {
    packageId: String(row.package_id),
    state: text(row.state) ?? '',
    reference: text(row.user_reference_number),
    tracking: objects(row.parcels).flatMap((parcel) => {
      const number = text(parcel.package_no)
      return number ? [{ number, url: text(parcel.tracking_url) }] : []
    }),
    costCents: Number.isFinite(cents) ? cents : null,
    cancelAvailable: row.cancel_available === true,
    pickupAvailable: row.pickup_available === true,
  }
}

const commandStatus = (value: unknown): CommandStatus =>
  value === 'successful' || value === 'partial_success' ? value : 'error'

const hhmm = (time: unknown) => String(time ?? '').slice(0, 5)

/** The first free term of the day that overlaps the wanted window, trimmed to that term. */
function pickSlot(proposals: unknown, window: PickupWindow): { from: string; to: string } | null {
  for (const proposal of objects(proposals)) {
    if (proposal.date !== window.date || proposal.available !== true) continue
    const from = hhmm(proposal.min_time) > window.from ? hhmm(proposal.min_time) : window.from
    const to = hhmm(proposal.max_time) < window.to ? hhmm(proposal.max_time) : window.to
    if (from < to) return { from, to }
  }
  return null
}

const ids = (packageIds: string[]) => packageIds.map((id) => ({ id }))
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// ---------------------------------------------------------------------------------------------
// REST client
// ---------------------------------------------------------------------------------------------

const media = (version: 1 | 2) => `application/vnd.furgonetka.v${version}+json`
const LABEL_ACCEPT = `application/pdf, ${media(1)}`

interface Call {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  query?: Record<string, string>
  body?: unknown
  /** v2 for packages and tracking, v1 for the rest. */
  version?: 1 | 2
  accept?: string
}

/** HTTP client of the Furgonetka REST API (OpenAPI of 2026-11-03, see spec 6d §5). */
export function createFurgonetkaClient(options: {
  url: string
  accessToken: () => Promise<string>
  fetch?: typeof globalThis.fetch
  timeoutMs?: number
  /** Pause between two reads of a running command. */
  pollMs?: number
  /** A command still running after this long is reported as `transient` (the shipment is found later). */
  pollTimeoutMs?: number
}): FurgonetkaClient {
  const base = options.url.replace(/\/+$/, '')
  const doFetch = options.fetch ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? 30_000
  const pollMs = options.pollMs ?? 1000
  const pollTimeoutMs = options.pollTimeoutMs ?? 30_000

  /** One request; the response comes back whatever its status, only a lost connection throws. */
  async function request(call: Call): Promise<{ response: Response; redact: Redact }> {
    const token = await options.accessToken()
    // The token is a secret: it must not reach an error message, and so not a log.
    const redact = redactor([token])
    const version = call.version ?? 1
    const headers: Record<string, string> = {
      Accept: call.accept ?? media(version),
      Authorization: `Bearer ${token}`,
    }
    if (call.body !== undefined) headers['Content-Type'] = media(version)
    const query = new URLSearchParams(call.query)
    try {
      const response = await doFetch(`${base}${call.path}${query.size ? `?${query}` : ''}`, {
        method: call.method,
        headers,
        ...(call.body !== undefined ? { body: JSON.stringify(call.body) } : {}),
        signal: AbortSignal.timeout(timeoutMs),
      })
      return { response, redact }
    } catch (error) {
      throw networkError(error, timeoutMs, redact)
    }
  }

  /** One request. Statuses in `tolerate` come back as responses, any other failure is thrown. */
  async function send(call: Call, tolerate: number[] = []): Promise<Response> {
    const { response, redact } = await request(call)
    if (response.ok || tolerate.includes(response.status)) return response
    throw await httpError(response, redact)
  }

  const getJson = async (call: Omit<Call, 'method'>) =>
    readJson(await send({ ...call, method: 'GET' }))

  /**
   * `PUT {path}` starts a command, `GET {path}` is read until it stops queueing and running. A PUT
   * that answers 400 `commandExists` means this command id was accepted before (a retry after a
   * timeout, for one): the command is not run twice, so the poll just goes on.
   */
  async function command(path: string, body: unknown): Promise<Obj> {
    const { response, redact } = await request({ method: 'PUT', path, body })
    if (!response.ok) {
      const accepted = response.status === 400 && isCommandExists(await peekJson(response))
      if (!accepted) throw await httpError(response, redact)
    }
    const deadline = Date.now() + pollTimeoutMs
    for (;;) {
      const state = await getJson({ path })
      if (state.status !== 'queueing' && state.status !== 'running') return state
      if (Date.now() + pollMs > deadline) {
        throw new FurgonetkaError(
          'transient',
          `Furgonetka nie zakończyła zlecenia w ${Math.ceil(pollTimeoutMs / 1000)} s.`,
        )
      }
      await sleep(pollMs)
    }
  }

  const packagePath = (packageId: string) => `/packages/${encodeURIComponent(packageId)}`

  return {
    async services() {
      const body = await getJson({ path: '/account/services' })
      return objects(body.services).map((service) => ({
        id: Number(service.id),
        service: String(service.service),
        owner: service.owner === 'client' ? 'client' : 'furgonetka',
      }))
    },

    async account() {
      const companies = await getJson({ path: '/account/companies' })
      const company = text(objects(companies.companies).find((row) => row.actual === true)?.name)
      if (company) return { label: company }
      const members = await getJson({ path: '/account/members' })
      const owner = text(objects(members.members).find((row) => row.owner === true)?.email)
      return { label: owner ?? 'Konto Furgonetki' }
    },

    async createPackage(input) {
      const response = await send({
        method: 'POST',
        path: '/packages',
        body: toPackageBody(input),
        version: 2,
      })
      const created = (await readJson(response)).package_id
      if (created === undefined || created === null) {
        throw new FurgonetkaError('permanent', 'Furgonetka nie zwróciła numeru paczki.')
      }
      return { packageId: String(created) }
    },

    async deletePackage(packageId) {
      await send({ method: 'DELETE', path: packagePath(packageId) }, [404])
    },

    async getPackage(packageId) {
      return toInfo(await getJson({ path: packagePath(packageId), version: 2 }))
    },

    async findPackage(reference) {
      const body = await getJson({
        path: '/packages',
        query: { list_type: 'all', query: reference },
        version: 2,
      })
      // The search is a text search – keep the exact match, and never a cancelled package.
      const found = objects(body.packages).find(
        (row) => row.user_reference_number === reference && row.state !== 'cancelled',
      )
      return found ? toInfo(found) : null
    },

    async orderPackages(commandId, packageIds) {
      const state = await command(`/order-commands/${encodeURIComponent(commandId)}`, {
        packages: ids(packageIds),
        label: { file_format: 'pdf', page_format: 'a6' },
      })
      const status = commandStatus(state.status)
      const raw = apiErrors(state.errors)
      if (status === 'error') {
        // Nothing was ordered. A balance too low; only connection errors: try again later; an
        // error that names no package (an unverified phone…) is the account's, not one package's.
        if (isNoFunds(raw)) throw new FurgonetkaError('no_funds', NO_FUNDS_MESSAGE)
        if (raw.length && raw.every((error) => error.code === 'carrierConnectionError')) {
          throw new FurgonetkaError('transient', flatten(raw))
        }
        const general = raw.filter((error) => !packageOf(error.path))
        if (general.length || !raw.length) {
          throw new FurgonetkaError(
            'permanent',
            flatten(general) || 'Furgonetka odrzuciła zamówienie przesyłek.',
          )
        }
      }
      return {
        status,
        ordered: (Array.isArray(state.successfully_ordered_packages)
          ? state.successfully_ordered_packages
          : []
        ).map(String),
        // A balance that ran out part way (`partial_success`) leaves the packages ordered before
        // it paid for: it is no throw, but the reason of the packages left out, in the shop's words.
        errors: raw.map((error) => ({
          packageId: packageOf(error.path),
          message: isBalanceError(error) ? NO_FUNDS_MESSAGE : error.message,
          code: error.code,
        })),
      }
    },

    async label(packageId) {
      const response = await send(
        {
          method: 'GET',
          path: `${packagePath(packageId)}/label`,
          query: { 'label[page_format]': 'a6' },
          accept: LABEL_ACCEPT,
        },
        [204],
      )
      if (response.status === 204) {
        throw new FurgonetkaError(
          'transient',
          'Etykieta jeszcze nie jest gotowa – spróbuj za chwilę.',
          204,
        )
      }
      return Buffer.from(await response.arrayBuffer())
    },

    async labels(packageIds) {
      const state = await command(`/documents-command/${randomUUID()}`, {
        packages: ids(packageIds),
        documents_types: ['labels'],
        label: { page_format: 'a6' },
      })
      const link = text(state.url)
      if (commandStatus(state.status) === 'error' || !link) {
        throw new FurgonetkaError(
          'permanent',
          flatten(apiErrors(state.errors)) || 'Furgonetka nie przygotowała etykiet.',
        )
      }
      // The link is signed (valid about ten minutes) and is fetched without the token.
      let response: Response
      try {
        response = await doFetch(new URL(link, `${base}/`).toString(), {
          headers: { Accept: LABEL_ACCEPT },
          signal: AbortSignal.timeout(timeoutMs),
        })
      } catch (error) {
        throw networkError(error, timeoutMs, redactor([]))
      }
      if (!response.ok) throw await httpError(response, redactor([]))
      return Buffer.from(await response.arrayBuffer())
    },

    async orderPickup(packageIds, window) {
      if (!packageIds.length) return { ordered: [], failed: [] }
      const proposals = await readJson(
        await send({
          method: 'POST',
          path: '/packages/pickup-date-proposals',
          body: { packages: ids(packageIds), ready_date: window.date },
        }),
      )
      const rows = objects(proposals.packages)
      const failed: PickupResult['failed'] = []
      // Packages that share a term share a command.
      const groups = new Map<string, { from: string; to: string; packageIds: string[] }>()
      for (const packageId of packageIds) {
        const row = rows.find((candidate) => String(candidate.package_id) === packageId)
        const slot = pickSlot(row?.proposals, window)
        if (!slot) {
          failed.push({
            packageId,
            message: `Brak terminu odbioru na ${pickupText(window)} – wybierz inny dzień`,
          })
          continue
        }
        const key = `${slot.from}-${slot.to}`
        const group = groups.get(key) ?? { ...slot, packageIds: [] }
        group.packageIds.push(packageId)
        groups.set(key, group)
      }

      const ordered: PickupResult['ordered'] = []
      let lost: FurgonetkaError | null = null
      for (const group of groups.values()) {
        let state: Obj
        try {
          state = await command(`/pickup-commands/${randomUUID()}`, {
            packages: ids(group.packageIds),
            pickup_date: { date: window.date, min_time: group.from, max_time: group.to },
          })
        } catch (error) {
          // A group that fails must not take the pickups booked for the others with it.
          if (!(error instanceof FurgonetkaError)) throw error
          lost ??= error
          for (const packageId of group.packageIds)
            failed.push({ packageId, message: error.message })
          continue
        }
        const errors = apiErrors(state.errors)
        const done = new Set<string>()
        for (const detail of objects(state.pickup_details)) {
          for (const id of Array.isArray(detail.package_ids) ? detail.package_ids : []) {
            const packageId = String(id)
            if (!group.packageIds.includes(packageId) || done.has(packageId)) continue
            done.add(packageId)
            ordered.push({
              packageId,
              pickupId: String(detail.pickup_id),
              from: group.from,
              to: group.to,
            })
          }
        }
        for (const packageId of group.packageIds.filter((id) => !done.has(id))) {
          // The package's own errors (its id is the key already), else those of the whole command.
          const own = errors
            .filter((error) => packageOf(error.path) === packageId)
            .map((error) => error.message)
            .join('; ')
          const general = flatten(errors.filter((error) => !packageOf(error.path)))
          failed.push({
            packageId,
            message: own || general || 'Furgonetka nie zamówiła odbioru.',
          })
        }
      }
      // Nothing booked and a command that threw: the caller should see the error, not a list.
      if (lost && !ordered.length) throw lost
      const order = (packageId: string) => packageIds.indexOf(packageId)
      return {
        ordered: ordered.sort((a, b) => order(a.packageId) - order(b.packageId)),
        failed: failed.sort((a, b) => order(a.packageId) - order(b.packageId)),
      }
    },

    async cancelPackages(packageIds) {
      const state = await command(`/cancel-command/${randomUUID()}`, { packages: ids(packageIds) })
      const details = objects(state.cancel_command_details)
      return packageIds.map((packageId) => ({
        packageId,
        ok: details.some(
          (detail) =>
            String(detail.package_id) === packageId &&
            (detail.cancel_success === true || detail.cancel_success === 'true'),
        ),
      }))
    },

    async tracking(packageId) {
      const body = await getJson({ path: `${packagePath(packageId)}/tracking`, version: 2 })
      const parcels = isObj(body.parcels) ? Object.values(body.parcels) : []
      const events = parcels.flatMap((parcel) =>
        objects(isObj(parcel) ? parcel.tracking : []).map((event) => ({
          state: String(event.state),
          at: String(event.datetime),
          label: text(event.status),
        })),
      )
      const time = (at: string) => Date.parse(at) || 0
      return events.sort((a, b) => time(a.at) - time(b.at))
    },
  }
}

// ---------------------------------------------------------------------------------------------
// OAuth (spec 6d §5.11)
// ---------------------------------------------------------------------------------------------

/**
 * Where the operator is sent to connect the account. The fake has no login page: it sends them
 * straight back to `redirectUri` with a code.
 */
export function authorizeUrl(config: FurgonetkaConfig, state: string, redirectUri: string): string {
  if (config.client === 'fake') {
    const back = new URL(redirectUri)
    back.searchParams.set('code', 'atrapa')
    back.searchParams.set('state', state)
    return back.toString()
  }
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId ?? '',
    redirect_uri: redirectUri,
    state,
    scope: 'api',
  })
  return `${config.url}/oauth/authorize?${params}`
}

async function tokenRequest(
  config: FurgonetkaConfig,
  form: Record<string, string>,
  doFetch: typeof globalThis.fetch,
): Promise<TokenSet> {
  const { url, clientId, clientSecret } = config
  if (!url || !clientId || !clientSecret) {
    throw new FurgonetkaError(
      'permanent',
      'Brak FURGONETKA_CLIENT_ID i FURGONETKA_CLIENT_SECRET – nie można połączyć z Furgonetką.',
    )
  }
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const redact = redactor([clientSecret, basic, form.code, form.refresh_token])
  const timeoutMs = 30_000
  let response: Response
  try {
    response = await doFetch(`${url}/oauth/token`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}`,
      },
      body: new URLSearchParams(form).toString(),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    throw networkError(error, timeoutMs, redact)
  }
  if (!response.ok) throw await httpError(response, redact)
  const body = await readJson(response)
  const accessToken = text(body.access_token)
  const refreshToken = text(body.refresh_token)
  const expiresIn = Number(body.expires_in)
  if (!accessToken || !refreshToken || !Number.isFinite(expiresIn)) {
    throw new FurgonetkaError('permanent', 'Furgonetka nie zwróciła tokenów.', response.status)
  }
  return { accessToken, refreshToken, accessExpiresAt: new Date(Date.now() + expiresIn * 1000) }
}

/** Swaps the code from the callback for tokens (the code lives 30 s). The fake always agrees. */
export async function exchangeCode(
  config: FurgonetkaConfig,
  code: string,
  redirectUri: string,
  fetch: typeof globalThis.fetch = globalThis.fetch,
): Promise<TokenSet> {
  if (config.client === 'fake') return fakeTokens('connect')
  return tokenRequest(
    config,
    { grant_type: 'authorization_code', code, redirect_uri: redirectUri },
    fetch,
  )
}

/**
 * Swaps the refresh token for new tokens. The old access and refresh tokens die at once, so the
 * caller must save the result before anything else. The fake honours `failNext('refresh')`.
 */
export async function refreshTokens(
  config: FurgonetkaConfig,
  refreshToken: string,
  fetch: typeof globalThis.fetch = globalThis.fetch,
): Promise<TokenSet> {
  if (config.client === 'fake') return fakeTokens('refresh')
  return tokenRequest(config, { grant_type: 'refresh_token', refresh_token: refreshToken }, fetch)
}

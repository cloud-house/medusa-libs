import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { Logger, MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys, MedusaError, Modules } from '@medusajs/framework/utils'
import { FURGONETKA_MODULE } from '../modules/furgonetka'
import type FurgonetkaModuleService from '../modules/furgonetka/service'
import type { ConnectionRow } from '../modules/furgonetka/service'
import type { ConnectionStateName } from '../types'
import { sendShipmentAlert } from './alerts'
import { FurgonetkaError } from './api-errors'
import {
  authorizeUrl,
  createFurgonetkaClient,
  exchangeCode,
  refreshTokens,
  type TokenSet,
} from './client'
import type { FurgonetkaConfig } from './config'
import { prefixedLogger as loggerOf } from './log'

/** A token is replaced when it ends in less than this (spec 6d §5.11). */
export const REFRESH_BEFORE_MS = 7 * 24 * 60 * 60 * 1000

/** One lock for everything that writes the tokens: a refresh token works once. */
const LOCK_KEY = 'furgonetka:tokens'
/** Longer than the 30 s of a token request, so a waiting caller outlasts the one that holds the lock. */
const LOCK_TIMEOUT_S = 60
/** How both locking providers (in-memory, Redis) end a wait that ran out. */
const LOCK_TIMED_OUT = 'Timed-out acquiring lock.'
/** The `state` of an OAuth round trip is valid for this long. */
const STATE_TTL_MS = 10 * 60_000

/** The token the fake hands out when nothing was connected – it has no API that checks it. */
const FAKE_TOKEN = 'atrapa'
/** The account the fake connects to (spec 6d §5.12). */
export const FAKE_ACCOUNT = 'atrapa@furgonetka.test'
const UNKNOWN_ACCOUNT = 'Konto Furgonetki'

export const NOT_CONFIGURED_MESSAGE =
  'Furgonetka nie jest skonfigurowana – realizacja ręczna jak dotąd'
export const NO_ADMIN_URL_MESSAGE = 'Ustaw MEDUSA_ADMIN_URL w .env backendu'
export const EXPIRED_MESSAGE =
  'Połączenie z Furgonetką wygasło – połącz ponownie w Settings → Wysyłka'
export const NOT_CONNECTED_MESSAGE =
  'Furgonetka nie jest połączona – połącz konto w Settings → Wysyłka'
const CONNECT_FAILED_MESSAGE = 'Nie udało się połączyć z Furgonetką – spróbuj ponownie.'

type FetchFn = typeof globalThis.fetch

const moduleOf = (container: MedusaContainer) =>
  container.resolve<FurgonetkaModuleService>(FURGONETKA_MODULE)

/** Workflow and module errors may come as plain objects with `message`. */
const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : String((error as { message?: unknown } | null)?.message ?? error)

/** One writer of the tokens at a time – the shop, the job and the admin may meet. */
async function locked<T>(container: MedusaContainer, job: () => Promise<T>): Promise<T> {
  try {
    return await container
      .resolve(Modules.LOCKING)
      .execute(LOCK_KEY, job, { timeout: LOCK_TIMEOUT_S })
  } catch (error) {
    // Another pass kept the lock for the whole wait – the connection itself is fine.
    if (errorText(error) === LOCK_TIMED_OUT) {
      throw new FurgonetkaError(
        'transient',
        'Połączenie z Furgonetką jest właśnie odświeżane – spróbuj za chwilę.',
      )
    }
    throw error
  }
}

/** The way back from Furgonetka: the panel's origin, not its `/app` path. `null` – not known. */
function redirectUriOf(config: FurgonetkaConfig): string | null {
  if (!config.adminUrl) return null
  try {
    return `${new URL(config.adminUrl).origin}/admin/furgonetka/callback`
  } catch {
    return null
  }
}

/** Why the account cannot be connected now (shown instead of the button); `null` – it can. */
export function connectBlocker(config: FurgonetkaConfig | null): string | null {
  if (!config) return NOT_CONFIGURED_MESSAGE
  // The fake has no login page, so it needs no way back.
  if (config.client === 'api' && !redirectUriOf(config)) return NO_ADMIN_URL_MESSAGE
  return null
}

const time = (value: Date | string | null) => (value ? new Date(value).getTime() : null)

/** The access token ends in less than a week, or nobody knows when. */
function refreshDue(row: ConnectionRow, now: Date): boolean {
  const ends = time(row.access_expires_at)
  return ends === null || ends - now.getTime() < REFRESH_BEFORE_MS
}

/** The connection was lost: tokens are dropped, the reason kept, and the shop is alerted once. */
async function disconnect(
  container: MedusaContainer,
  row: ConnectionRow,
  reason: string,
  now: Date,
): Promise<void> {
  const furgonetka = moduleOf(container)
  const logger = loggerOf(container)
  await furgonetka.updateFurgonetkaConnections({
    id: row.id,
    state: 'disconnected',
    access_token: null,
    refresh_token: null,
    access_expires_at: null,
    last_error: reason,
  })
  logger.warn(`Połączenie z Furgonetką rozłączone: ${reason}`)
  if (row.alerted_for === 'disconnected') return
  try {
    const sent = await sendShipmentAlert(
      container,
      'disconnected',
      { orderId: null, displayId: null, message: reason },
      now,
    )
    // An alert that could not go out stays unmarked; the log has it, and so does the panel.
    if (sent)
      await furgonetka.updateFurgonetkaConnections({ id: row.id, alerted_for: 'disconnected' })
  } catch (error) {
    logger.error(`Alert o rozłączeniu Furgonetki nie wyszedł: ${errorText(error)}`)
  }
}

/**
 * The access token for a call to Furgonetka. A token that ends in less than a week is replaced
 * first: both new tokens are saved at once, under a lock, because the old refresh token dies with
 * the first use. A refusal of the refresh (`auth`) disconnects the shop and alerts once; a failure
 * that may pass (network, 5xx) is thrown as it is and leaves the connection alone.
 *
 * The fake needs no token; it still rotates a connection that exists, so the refresh failure of
 * the fake (`failNext('refresh')`) plays out the same way as a real one.
 */
export async function accessToken(
  container: MedusaContainer,
  config: FurgonetkaConfig,
  now: Date = new Date(),
  fetch?: FetchFn,
): Promise<string> {
  return locked(container, async () => {
    const furgonetka = moduleOf(container)
    const row = await furgonetka.connection()
    if (config.client === 'fake' && !row?.connected_at) return FAKE_TOKEN
    if (row?.state !== 'connected' || !row.access_token || !row.refresh_token) {
      throw new FurgonetkaError('auth', row?.connected_at ? EXPIRED_MESSAGE : NOT_CONNECTED_MESSAGE)
    }
    if (!refreshDue(row, now)) return row.access_token

    let tokens: TokenSet
    try {
      tokens = await refreshTokens(config, row.refresh_token, fetch)
    } catch (error) {
      if (error instanceof FurgonetkaError && error.kind === 'auth') {
        await disconnect(container, row, error.message, now)
        throw new FurgonetkaError('auth', EXPIRED_MESSAGE, error.status)
      }
      throw error
    }
    // One write for both tokens. If it fails, the next refresh meets `invalid_grant` and the
    // shop asks to connect again – nothing worse than that.
    await furgonetka.updateFurgonetkaConnections({
      id: row.id,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      access_expires_at: tokens.accessExpiresAt,
    })
    return tokens.accessToken
  })
}

/** Where the connection stands, for the panel and the guards. */
export async function connectionState(
  container: MedusaContainer,
  config: FurgonetkaConfig | null,
): Promise<{ state: ConnectionStateName; account: string | null }> {
  if (!config) return { state: 'not_configured', account: null }
  const row = await moduleOf(container).connection()
  if (row?.state === 'connected') return { state: 'connected', account: row.account }
  // A row that was connected once and is not now is a lost connection; any other is a new shop.
  if (row?.connected_at) return { state: 'disconnected', account: row.account }
  return { state: 'not_connected', account: null }
}

/** The columns of a connection that has just been made. */
function connectedValues(tokens: TokenSet, account: string, now: Date) {
  return {
    state: 'connected' as const,
    account,
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    access_expires_at: tokens.accessExpiresAt,
    connected_at: now,
    oauth_state: null,
    oauth_state_expires_at: null,
    last_error: null,
    alerted_for: null,
  }
}

/** Starts the OAuth round trip: saves a one-time `state` and says where to send the operator. */
export async function startConnect(
  container: MedusaContainer,
  config: FurgonetkaConfig,
  now: Date,
): Promise<{ url: string }> {
  const redirectUri = redirectUriOf(config)
  if (!redirectUri) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, NO_ADMIN_URL_MESSAGE)
  return locked(container, async () => {
    const furgonetka = moduleOf(container)
    const state = randomBytes(32).toString('hex')
    const values = {
      oauth_state: state,
      oauth_state_expires_at: new Date(now.getTime() + STATE_TTL_MS),
    }
    const row = await furgonetka.connection()
    if (row) await furgonetka.updateFurgonetkaConnections({ id: row.id, ...values })
    else await furgonetka.createFurgonetkaConnections(values)
    return { url: authorizeUrl(config, state, redirectUri) }
  })
}

function stateMatches(row: ConnectionRow, state: string, now: Date): boolean {
  if (!state || !row.oauth_state) return false
  const saved = Buffer.from(row.oauth_state)
  const given = Buffer.from(state)
  if (saved.length !== given.length || !timingSafeEqual(saved, given)) return false
  const ends = time(row.oauth_state_expires_at)
  return ends !== null && ends >= now.getTime()
}

/** The account's name; the code is spent by now, so a name that cannot be read is no reason to fail. */
async function accountName(
  config: FurgonetkaConfig,
  tokens: TokenSet,
  logger: Logger,
  fetch?: FetchFn,
): Promise<string> {
  if (config.client === 'fake' || !config.url) return FAKE_ACCOUNT
  try {
    // With the new token itself: asking for the saved one would wait for the lock held here.
    const client = createFurgonetkaClient({
      url: config.url,
      accessToken: async () => tokens.accessToken,
      fetch,
    })
    return (await client.account()).label
  } catch (error) {
    logger.warn(`Nazwa konta Furgonetki nieczytelna: ${errorText(error)}`)
    return UNKNOWN_ACCOUNT
  }
}

/**
 * The way back from Furgonetka: a matching, unexpired `state` (used once) and the code, which
 * lives 30 s and so is exchanged at once. Anything else is refused without a reason, so the
 * callback tells nothing to a stranger.
 */
export async function finishConnect(
  container: MedusaContainer,
  config: FurgonetkaConfig,
  code: string,
  state: string,
  now: Date,
  fetch?: FetchFn,
): Promise<void> {
  const logger = loggerOf(container)
  const refuse = () => new MedusaError(MedusaError.Types.NOT_ALLOWED, CONNECT_FAILED_MESSAGE)
  const redirectUri = redirectUriOf(config)
  if (config.client === 'api' && !redirectUri) throw refuse()

  await locked(container, async () => {
    const furgonetka = moduleOf(container)
    const row = await furgonetka.connection()
    if (!row || !code || !stateMatches(row, state, now)) throw refuse()
    // The state works once – spend it before the code goes anywhere.
    await furgonetka.updateFurgonetkaConnections({
      id: row.id,
      oauth_state: null,
      oauth_state_expires_at: null,
    })
    let values: ReturnType<typeof connectedValues>
    try {
      const tokens = await exchangeCode(config, code, redirectUri ?? '', fetch)
      values = connectedValues(tokens, await accountName(config, tokens, logger, fetch), now)
    } catch (error) {
      logger.error(`Połączenie z Furgonetką nie powiodło się: ${errorText(error)}`)
      throw refuse()
    }
    await furgonetka.updateFurgonetkaConnections({ id: row.id, ...values })
  })
}

/** The fake: „Połącz” saves the connection at once, with no round trip (spec 6d §5.12). */
export async function connectFake(
  container: MedusaContainer,
  config: FurgonetkaConfig,
  now: Date,
): Promise<void> {
  if (config.client !== 'fake') throw new Error('connectFake works only with the fake.')
  await locked(container, async () => {
    const furgonetka = moduleOf(container)
    const values = connectedValues(await exchangeCode(config, FAKE_TOKEN, ''), FAKE_ACCOUNT, now)
    const row = await furgonetka.connection()
    if (row) await furgonetka.updateFurgonetkaConnections({ id: row.id, ...values })
    else await furgonetka.createFurgonetkaConnections(values)
  })
}

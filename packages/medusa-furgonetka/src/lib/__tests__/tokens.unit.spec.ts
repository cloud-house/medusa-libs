import { MedusaError } from '@medusajs/framework/utils'
import { sendShipmentAlert } from '../alerts'
import { FurgonetkaError } from '../api-errors'
import type { FurgonetkaConfig } from '../config'
import { clientFor } from '../connect'
import { fakeFurgonetka } from '../fake'
import {
  accessToken,
  connectFake,
  connectionState,
  finishConnect,
  REFRESH_BEFORE_MS,
  startConnect,
} from '../tokens'
import { furgonetkaService } from './shop-options'

jest.mock('../alerts', () => ({ sendShipmentAlert: jest.fn() }))

const alert = sendShipmentAlert as unknown as jest.Mock

const DAY = 24 * 3600 * 1000
const NOW = new Date('2026-11-10T12:00:00Z')
const EXPIRED_MESSAGE = 'Połączenie z Furgonetką wygasło – połącz ponownie w Settings → Wysyłka'
const CONNECT_MESSAGE = 'Nie udało się połączyć z Furgonetką – spróbuj ponownie.'

const apiConfig: FurgonetkaConfig = {
  client: 'api',
  url: 'https://api.sandbox.furgonetka.pl',
  clientId: 'app-1',
  clientSecret: 'sec-1',
  webhookToken: null,
  pickupHours: { from: '10:00', to: '15:00' },
  pickupTodayUntil: '12:00',
  adminUrl: 'https://api.chonasupa.pl/app',
}
const fakeConfig: FurgonetkaConfig = {
  ...apiConfig,
  client: 'fake',
  url: null,
  clientId: null,
  clientSecret: null,
  webhookToken: 'atrapa',
}

type Row = Record<string, unknown>

const EMPTY_ROW: Row = {
  id: 'fgc_1',
  state: 'disconnected',
  account: null,
  access_token: null,
  refresh_token: null,
  access_expires_at: null,
  connected_at: null,
  oauth_state: null,
  oauth_state_expires_at: null,
  last_error: null,
  alerted_for: null,
}

/** A connected row whose access token expires `days` days after NOW. */
const connected = (days: number, over: Row = {}): Row => ({
  ...EMPTY_ROW,
  state: 'connected',
  account: 'Acme Shop sp. z o.o.',
  access_token: 'acc-0',
  refresh_token: 'ref-0',
  access_expires_at: new Date(NOW.getTime() + days * DAY),
  connected_at: new Date('2026-10-01T10:00:00Z'),
  ...over,
})

/** The module service on one row in memory, like the real one for the calls the code makes. */
function setup(initial: Row | null) {
  let row: Row | null = initial ? { ...initial } : null
  const furgonetka = {
    ...furgonetkaService(),
    connection: jest.fn(async () => (row ? { ...row } : null)),
    createFurgonetkaConnections: jest.fn(async (data: Row) => {
      row = { ...EMPTY_ROW, ...data }
      return { ...row }
    }),
    updateFurgonetkaConnections: jest.fn(async (data: Row) => {
      row = { ...row, ...data }
      return { ...row }
    }),
  }
  // The same promise chain per key as the in-memory locking provider: one job at a time.
  const tails = new Map<string, Promise<unknown>>()
  const locking = {
    execute: jest.fn(async (key: string, job: () => Promise<unknown>) => {
      const previous = tails.get(key) ?? Promise.resolve()
      const run = previous.then(job, job)
      tails.set(
        key,
        run.catch(() => undefined),
      )
      return run
    }),
  }
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const services: Record<string, unknown> = { furgonetka, locking, logger }
  const container = { resolve: (key: string) => services[key] } as never
  return { container, furgonetka, locking, logger, row: () => row as Row }
}

type Reply = { status?: number; body?: unknown }

/**
 * Furgonetka as far as the tokens go: the token endpoint hands out `acc-N`/`ref-N`, and a
 * refresh token works once – a second use is the 400 `invalid_grant` of the real API.
 */
function server(opts: { valid?: string[]; replies?: Reply[]; delayMs?: number } = {}) {
  const valid = new Set(opts.valid ?? ['ref-0'])
  const calls: { path: string; form: Record<string, string>; auth: string | null }[] = []
  let serial = 0
  const fetch = jest.fn(async (input: string, init?: RequestInit) => {
    const path = new URL(input).pathname
    const form = Object.fromEntries(new URLSearchParams(String(init?.body ?? '')))
    const headers = init?.headers as Record<string, string> | undefined
    calls.push({ path, form, auth: headers?.Authorization ?? null })
    if (opts.delayMs) await new Promise((resolve) => setTimeout(resolve, opts.delayMs))
    const scripted = opts.replies?.shift()
    if (scripted)
      return new Response(JSON.stringify(scripted.body ?? {}), { status: scripted.status })
    if (path === '/account/services') {
      return new Response(JSON.stringify({ services: [] }), { status: 200 })
    }
    if (path === '/account/companies') {
      return new Response(
        JSON.stringify({ companies: [{ name: 'Acme Shop sp. z o.o.', actual: true }] }),
        { status: 200 },
      )
    }
    if (path === '/oauth/token') {
      const wanted = form.refresh_token
      if (form.grant_type === 'refresh_token' && !(wanted && valid.delete(wanted))) {
        return new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 })
      }
      serial += 1
      valid.add(`ref-${serial}`)
      return new Response(
        JSON.stringify({
          access_token: `acc-${serial}`,
          refresh_token: `ref-${serial}`,
          expires_in: 31 * 24 * 3600,
        }),
        { status: 200 },
      )
    }
    return new Response('{}', { status: 404 })
  })
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls, mock: fetch }
}

const refreshes = (calls: { form: Record<string, string> }[]) =>
  calls.filter((call) => call.form.grant_type === 'refresh_token')

async function failure(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise
  } catch (error) {
    return error as Error
  }
  throw new Error('Expected the promise to fail')
}

beforeEach(() => {
  alert.mockReset()
  alert.mockResolvedValue(true)
  fakeFurgonetka().reset()
})

describe('accessToken', () => {
  it('refreshes a week before the access token ends', () => {
    expect(REFRESH_BEFORE_MS).toBe(7 * DAY)
  })

  it('returns a token that is valid for 20 days without refreshing', async () => {
    const { container, furgonetka } = setup(connected(20))
    const { fetch, calls } = server()

    await expect(accessToken(container, apiConfig, NOW, fetch)).resolves.toBe('acc-0')

    expect(calls).toHaveLength(0)
    expect(furgonetka.updateFurgonetkaConnections).not.toHaveBeenCalled()
  })

  it('does not refresh a token that ends in exactly 7 days', async () => {
    const { container } = setup(connected(7))
    const { fetch, calls } = server()

    await expect(accessToken(container, apiConfig, NOW, fetch)).resolves.toBe('acc-0')

    expect(calls).toHaveLength(0)
  })

  it('refreshes a token that ends in 5 days once and saves both new tokens', async () => {
    const { container, row, furgonetka } = setup(connected(5))
    const { fetch, calls } = server()

    await expect(accessToken(container, apiConfig, NOW, fetch)).resolves.toBe('acc-1')

    expect(refreshes(calls)).toHaveLength(1)
    expect(refreshes(calls)[0]?.form.refresh_token).toBe('ref-0')
    expect(furgonetka.updateFurgonetkaConnections).toHaveBeenCalledTimes(1)
    expect(row()).toMatchObject({
      state: 'connected',
      access_token: 'acc-1',
      refresh_token: 'ref-1',
    })
    expect((row().access_expires_at as Date).getTime()).toBeGreaterThan(NOW.getTime() + 30 * DAY)
    // A second use finds the new token valid and does not go to Furgonetka again.
    await expect(accessToken(container, apiConfig, NOW, fetch)).resolves.toBe('acc-1')
    expect(refreshes(calls)).toHaveLength(1)
  })

  it('refreshes a token with no known end', async () => {
    const { container } = setup(connected(20, { access_expires_at: null }))
    const { fetch, calls } = server()

    await expect(accessToken(container, apiConfig, NOW, fetch)).resolves.toBe('acc-1')

    expect(refreshes(calls)).toHaveLength(1)
  })

  it('refreshes once for two calls at the same time and gives both the new token', async () => {
    const { container, locking } = setup(connected(5))
    // The refresh token works once, so a second refresh would disconnect the shop.
    const { fetch, calls } = server({ delayMs: 20 })

    const results = await Promise.all([
      accessToken(container, apiConfig, NOW, fetch),
      accessToken(container, apiConfig, NOW, fetch),
    ])

    expect(results).toEqual(['acc-1', 'acc-1'])
    expect(refreshes(calls)).toHaveLength(1)
    expect(locking.execute.mock.calls.map((call) => call[0])).toEqual([
      'furgonetka:tokens',
      'furgonetka:tokens',
    ])
  })

  it('disconnects on a refresh the account refuses, alerts once and tells how to reconnect', async () => {
    const { container, row, logger } = setup(connected(5))
    const { fetch, calls } = server({ valid: [] })

    const first = await failure(accessToken(container, apiConfig, NOW, fetch))
    const second = await failure(accessToken(container, apiConfig, NOW, fetch))
    const third = await failure(accessToken(container, apiConfig, NOW, fetch))

    for (const error of [first, second, third]) {
      expect(error).toBeInstanceOf(FurgonetkaError)
      expect((error as FurgonetkaError).kind).toBe('auth')
      expect(error.message).toBe(EXPIRED_MESSAGE)
    }
    // The spent refresh token is not sent again once the shop is disconnected.
    expect(refreshes(calls)).toHaveLength(1)
    expect(row()).toMatchObject({
      state: 'disconnected',
      access_token: null,
      refresh_token: null,
      alerted_for: 'disconnected',
    })
    expect(String(row().last_error)).toContain('Furgonetka odrzuciła autoryzację')
    expect(alert).toHaveBeenCalledTimes(1)
    expect(alert).toHaveBeenCalledWith(
      container,
      'disconnected',
      { orderId: null, displayId: null, message: row().last_error },
      NOW,
    )
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('does not mark the alert as sent when it could not go out', async () => {
    alert.mockResolvedValue(false)
    const { container, row } = setup(connected(5))
    const { fetch } = server({ valid: [] })

    await failure(accessToken(container, apiConfig, NOW, fetch))

    expect(row()).toMatchObject({ state: 'disconnected', alerted_for: null })
  })

  it('stays disconnected and tells the error when the alert itself fails', async () => {
    alert.mockRejectedValue(new Error('SMTP down'))
    const { container, row, logger } = setup(connected(5))
    const { fetch } = server({ valid: [] })

    const error = await failure(accessToken(container, apiConfig, NOW, fetch))

    expect(error.message).toBe(EXPIRED_MESSAGE)
    expect(row()).toMatchObject({ state: 'disconnected', alerted_for: null })
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('[Shop]'))
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('SMTP down'))
  })

  it('does not alert twice for a problem it already alerted about', async () => {
    const { container } = setup(connected(5, { alerted_for: 'disconnected' }))
    const { fetch } = server({ valid: [] })

    await failure(accessToken(container, apiConfig, NOW, fetch))

    expect(alert).not.toHaveBeenCalled()
  })

  it('keeps the connection when Furgonetka is down for a moment', async () => {
    const { container, row } = setup(connected(5))
    const { fetch } = server({ replies: [{ status: 503 }] })

    const error = await failure(accessToken(container, apiConfig, NOW, fetch))

    expect((error as FurgonetkaError).kind).toBe('transient')
    expect(row()).toMatchObject({
      state: 'connected',
      access_token: 'acc-0',
      refresh_token: 'ref-0',
      last_error: null,
    })
    expect(alert).not.toHaveBeenCalled()
  })

  it('keeps the connection when the network is down', async () => {
    const { container, row } = setup(connected(5))
    const fetch = (async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof globalThis.fetch

    const error = await failure(accessToken(container, apiConfig, NOW, fetch))

    expect((error as FurgonetkaError).kind).toBe('transient')
    expect(row().state).toBe('connected')
    expect(alert).not.toHaveBeenCalled()
  })

  it('tells a lock that stayed taken is a short wait, not a lost connection', async () => {
    const { container, locking, row } = setup(connected(5))
    locking.execute.mockRejectedValue(new Error('Timed-out acquiring lock.'))

    const error = await failure(accessToken(container, apiConfig, NOW, server().fetch))

    expect((error as FurgonetkaError).kind).toBe('transient')
    expect(row().state).toBe('connected')
  })

  it('refuses when the shop was never connected', async () => {
    const { container } = setup(null)

    const error = await failure(accessToken(container, apiConfig, NOW, server().fetch))

    expect((error as FurgonetkaError).kind).toBe('auth')
    expect(error.message).toBe('Furgonetka nie jest połączona – połącz konto w Settings → Wysyłka')
    expect(alert).not.toHaveBeenCalled()
  })

  describe('with the fake', () => {
    it('needs no connection to hand out a token', async () => {
      const { container } = setup(null)

      await expect(accessToken(container, fakeConfig, NOW)).resolves.toBe('atrapa')
    })

    it('returns the saved token while it is valid', async () => {
      const { container } = setup(connected(20))

      await expect(accessToken(container, fakeConfig, NOW)).resolves.toBe('acc-0')
    })

    it('rotates the tokens of a connection that is due', async () => {
      const { container, row } = setup(connected(5))

      const token = await accessToken(container, fakeConfig, NOW)

      expect(token).toMatch(/^atrapa-access-\d+$/)
      expect(row()).toMatchObject({ state: 'connected', access_token: token })
      expect(row().refresh_token).toMatch(/^atrapa-refresh-\d+$/)
    })

    it('honours failNext(refresh): disconnected, one alert, the expired message', async () => {
      fakeFurgonetka().failNext('refresh')
      const { container, row } = setup(connected(5))

      const error = await failure(accessToken(container, fakeConfig, NOW))
      await failure(accessToken(container, fakeConfig, NOW))

      expect((error as FurgonetkaError).kind).toBe('auth')
      expect(error.message).toBe(EXPIRED_MESSAGE)
      expect(row()).toMatchObject({ state: 'disconnected', alerted_for: 'disconnected' })
      expect(alert).toHaveBeenCalledTimes(1)
    })

    it('does not let a disconnected connection through', async () => {
      const { container } = setup({ ...EMPTY_ROW, connected_at: new Date('2026-10-01T10:00:00Z') })

      const error = await failure(accessToken(container, fakeConfig, NOW))

      expect(error.message).toBe(EXPIRED_MESSAGE)
    })
  })
})

describe('connectionState', () => {
  it('is not_configured without a configuration', async () => {
    const { container } = setup(connected(20))

    await expect(connectionState(container, null)).resolves.toEqual({
      state: 'not_configured',
      account: null,
    })
  })

  it('is not_connected before the first connection', async () => {
    await expect(connectionState(setup(null).container, apiConfig)).resolves.toEqual({
      state: 'not_connected',
      account: null,
    })
    // A started connection (the CSRF state saved) is still not a connection.
    const started = setup({ ...EMPTY_ROW, oauth_state: 'abc' })
    await expect(connectionState(started.container, apiConfig)).resolves.toEqual({
      state: 'not_connected',
      account: null,
    })
  })

  it('is connected with the account', async () => {
    await expect(connectionState(setup(connected(20)).container, apiConfig)).resolves.toEqual({
      state: 'connected',
      account: 'Acme Shop sp. z o.o.',
    })
  })

  it('is disconnected once a connection was lost', async () => {
    const lost = setup(
      connected(20, { state: 'disconnected', access_token: null, refresh_token: null }),
    )

    await expect(connectionState(lost.container, apiConfig)).resolves.toEqual({
      state: 'disconnected',
      account: 'Acme Shop sp. z o.o.',
    })
  })
})

describe('startConnect', () => {
  it('saves a 32-byte state for 10 minutes and sends the operator to Furgonetka', async () => {
    const { container, row, locking } = setup(null)

    const { url } = await startConnect(container, apiConfig, NOW)

    expect(row().oauth_state).toMatch(/^[0-9a-f]{64}$/)
    expect(row().oauth_state_expires_at).toEqual(new Date(NOW.getTime() + 10 * 60_000))
    expect(row().state).toBe('disconnected')
    const target = new URL(url)
    expect(`${target.origin}${target.pathname}`).toBe(
      'https://api.sandbox.furgonetka.pl/oauth/authorize',
    )
    expect(Object.fromEntries(target.searchParams)).toEqual({
      response_type: 'code',
      client_id: 'app-1',
      redirect_uri: 'https://api.chonasupa.pl/admin/furgonetka/callback',
      state: row().oauth_state,
      scope: 'api',
    })
    expect(locking.execute.mock.calls[0]?.[0]).toBe('furgonetka:tokens')
  })

  it('keeps the tokens of a connected shop that connects again and replaces the state', async () => {
    const { container, row, furgonetka } = setup(connected(20, { oauth_state: 'old' }))

    await startConnect(container, apiConfig, NOW)

    expect(furgonetka.createFurgonetkaConnections).not.toHaveBeenCalled()
    expect(row()).toMatchObject({ state: 'connected', access_token: 'acc-0' })
    expect(row().oauth_state).not.toBe('old')
  })

  it('needs the panel address for the way back', async () => {
    const { container } = setup(null)

    const error = await failure(startConnect(container, { ...apiConfig, adminUrl: null }, NOW))

    expect(error).toBeInstanceOf(MedusaError)
    expect((error as MedusaError).type).toBe(MedusaError.Types.NOT_ALLOWED)
    expect(error.message).toBe('Ustaw MEDUSA_ADMIN_URL w .env backendu')
  })
})

describe('finishConnect', () => {
  async function started() {
    const ctx = setup(null)
    await startConnect(ctx.container, apiConfig, NOW)
    return { ...ctx, state: ctx.row().oauth_state as string }
  }
  const later = new Date(NOW.getTime() + 60_000)

  it('exchanges the code at once and saves tokens, account and the time', async () => {
    const { container, row, state } = await started()
    const { fetch, calls } = server()

    await finishConnect(container, apiConfig, 'code-1', state, later, fetch)

    const exchange = calls.find((call) => call.form.grant_type === 'authorization_code')
    expect(exchange?.form).toEqual({
      grant_type: 'authorization_code',
      code: 'code-1',
      redirect_uri: 'https://api.chonasupa.pl/admin/furgonetka/callback',
    })
    expect(row()).toMatchObject({
      state: 'connected',
      account: 'Acme Shop sp. z o.o.',
      access_token: 'acc-1',
      refresh_token: 'ref-1',
      connected_at: later,
      oauth_state: null,
      oauth_state_expires_at: null,
      last_error: null,
    })
    // The account is read with the new token – asking for the saved one would wait for its own lock.
    expect(calls.find((call) => call.path === '/account/companies')?.auth).toBe('Bearer acc-1')
  })

  it('clears the alert of a lost connection', async () => {
    const { container, row, state, furgonetka } = await started()
    await furgonetka.updateFurgonetkaConnections({
      id: 'fgc_1',
      alerted_for: 'disconnected',
      last_error: 'stare',
    })

    await finishConnect(container, apiConfig, 'code-1', state, later, server().fetch)

    expect(row()).toMatchObject({ alerted_for: null, last_error: null })
  })

  it('still connects when the account name cannot be read', async () => {
    const { container, row, state } = await started()
    const { fetch } = server({
      replies: [
        {
          status: 200,
          body: { access_token: 'acc-1', refresh_token: 'ref-1', expires_in: 2678400 },
        },
        { status: 503 },
      ],
    })

    await finishConnect(container, apiConfig, 'code-1', state, later, fetch)

    expect(row()).toMatchObject({
      state: 'connected',
      account: 'Konto Furgonetki',
      access_token: 'acc-1',
    })
  })

  it.each([
    ['a state that was not issued', 'wrong'],
    ['an empty state', ''],
  ])('refuses %s without calling Furgonetka', async (_label, wrong) => {
    const { container, row } = await started()
    const { fetch, calls } = server()

    const error = await failure(finishConnect(container, apiConfig, 'code-1', wrong, later, fetch))

    expect(error).toBeInstanceOf(MedusaError)
    expect((error as MedusaError).type).toBe(MedusaError.Types.NOT_ALLOWED)
    expect(error.message).toBe(CONNECT_MESSAGE)
    expect(calls).toHaveLength(0)
    expect(row().state).toBe('disconnected')
  })

  it('refuses when no connection was started', async () => {
    const { container } = setup(null)

    const error = await failure(
      finishConnect(container, apiConfig, 'code-1', 'abc', later, server().fetch),
    )

    expect(error.message).toBe(CONNECT_MESSAGE)
  })

  it('refuses a state after its 10 minutes', async () => {
    const { container, state } = await started()
    const { fetch, calls } = server()
    const tooLate = new Date(NOW.getTime() + 10 * 60_000 + 1)

    const error = await failure(
      finishConnect(container, apiConfig, 'code-1', state, tooLate, fetch),
    )

    expect(error.message).toBe(CONNECT_MESSAGE)
    expect(calls).toHaveLength(0)
  })

  it('uses a state only once', async () => {
    const { container, state } = await started()
    const { fetch } = server()
    await finishConnect(container, apiConfig, 'code-1', state, later, fetch)

    const error = await failure(finishConnect(container, apiConfig, 'code-2', state, later, fetch))

    expect(error.message).toBe(CONNECT_MESSAGE)
  })

  it('refuses a code Furgonetka does not accept, logs why, and leaves the shop as it was', async () => {
    const { container, row, state, logger } = await started()
    const { fetch } = server({ replies: [{ status: 400, body: { error: 'invalid_grant' } }] })

    const error = await failure(finishConnect(container, apiConfig, 'code-1', state, later, fetch))

    expect(error).toBeInstanceOf(MedusaError)
    expect(error.message).toBe(CONNECT_MESSAGE)
    expect(row()).toMatchObject({ state: 'disconnected', access_token: null, oauth_state: null })
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('[Shop]'))
  })
})

describe('connectFake', () => {
  it('connects at once to the fake account without a round trip', async () => {
    const { container, row } = setup(null)

    await connectFake(container, fakeConfig, NOW)

    expect(row()).toMatchObject({
      state: 'connected',
      account: 'atrapa@furgonetka.test',
      connected_at: NOW,
      oauth_state: null,
    })
    expect(row().access_token).toMatch(/^atrapa-access-\d+$/)
    await expect(connectionState(container, fakeConfig)).resolves.toEqual({
      state: 'connected',
      account: 'atrapa@furgonetka.test',
    })
  })

  it('works without the panel address', async () => {
    const { container, row } = setup(null)

    await connectFake(container, { ...fakeConfig, adminUrl: null }, NOW)

    expect(row().state).toBe('connected')
  })
})

describe('clientFor', () => {
  it('gives the fake its in-process client', async () => {
    const { container } = setup(null)

    const services = await clientFor(container, fakeConfig).services()

    expect(services.map((service) => service.service)).toEqual(['dpd', 'inpostkurier', 'inpost'])
  })

  it('asks the API with the saved access token', async () => {
    // clientFor reads the real clock, so the expiry is counted from it (not from the fixed NOW).
    const { container } = setup(
      connected(20, { access_expires_at: new Date(Date.now() + 20 * DAY) }),
    )
    const seen: (string | null)[] = []
    const fetch = (async (_url: string, init?: RequestInit) => {
      seen.push((init?.headers as Record<string, string> | undefined)?.Authorization ?? null)
      return new Response(JSON.stringify({ services: [] }), { status: 200 })
    }) as unknown as typeof globalThis.fetch

    await clientFor(container, apiConfig, fetch).services()

    expect(seen).toEqual(['Bearer acc-0'])
  })

  it('refreshes a token that is due before the call, through the same fetch', async () => {
    // clientFor reads the real clock, so the expiry is counted from it.
    const { container, row } = setup(
      connected(2, { access_expires_at: new Date(Date.now() + 2 * DAY) }),
    )
    const { fetch, calls } = server()

    await clientFor(container, apiConfig, fetch).services()

    expect(refreshes(calls)).toHaveLength(1)
    expect(calls.find((call) => call.path === '/account/services')?.auth).toBe('Bearer acc-1')
    expect(row().access_token).toBe('acc-1')
  })
})

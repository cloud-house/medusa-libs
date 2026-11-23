import { createServer, type Server } from 'node:http'
import { createRequire } from 'node:module'
import { type AddressInfo, connect } from 'node:net'
import { ACCOUNTS_MODULE } from '../../../modules/accounts'
import { resolveOptions } from '../../../options'
import { closedRoutes, rejectCustomerMetadata } from '../body-guards'

// The guards decide by the path Express routes by, so they are tested on a real Express app – the
// one Medusa runs on (a dependency of the framework, not of this package) – with raw request lines.
interface ExpressApp {
  use: (...args: unknown[]) => void
  post: (...args: unknown[]) => void
}
const express = createRequire(require.resolve('@medusajs/framework'))(
  'express',
) as (() => ExpressApp) & {
  json: () => unknown
}

jest.setTimeout(60_000)

const REACHED = { reached: true }

// What `accountsOptions(req.scope)` reads: the `accounts` module holding the resolved options.
const options = resolveOptions({
  paths: { confirmEmail: '/a', passwordReset: '/b', setPassword: '/c' },
})
const scope = {
  resolve: (key: string) => (key === ACCOUNTS_MODULE ? { getOptions: () => options } : null),
}

function buildApp(guarded: boolean): ExpressApp {
  const app = express()
  app.use(express.json())
  app.use((req: { scope?: unknown }, _res: unknown, next: () => void) => {
    req.scope = scope
    next()
  })
  if (guarded) {
    app.use('/store/widgets', closedRoutes(['/store/widgets']))
    app.use(
      '/auth/customer/emailpass/register',
      closedRoutes(['/auth/customer/emailpass/register']),
    )
    app.use('/store/customers', rejectCustomerMetadata)
  }
  for (const path of [
    '/store/widgets',
    '/store/widgets/claim',
    '/store/widgets/lookup',
    '/store/widget-kinds',
    '/auth/customer/emailpass/register',
    '/store/customers',
    '/store/customers/me',
    '/store/customers/me/addresses',
  ]) {
    app.post(path, (_req: unknown, res: { json: (body: unknown) => void }) => res.json(REACHED))
  }
  return app
}

interface Answer {
  status: number | undefined
  body: Record<string, unknown> | null
  /** The handler behind the guards answered. */
  reached: boolean
}

/** A POST with the request target written byte for byte – no client normalises it. */
function send(port: number, target: string, body = '{}'): Promise<Answer> {
  return new Promise((resolve) => {
    const request = Buffer.from(
      `POST ${target} HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`,
      'latin1',
    )
    const socket = connect(port, '127.0.0.1', () => socket.write(request))
    const chunks: Buffer[] = []
    const finish = () => {
      const text = Buffer.concat(chunks).toString('utf8')
      const status = Number(/^HTTP\/1\.1 (\d+)/.exec(text)?.[1]) || undefined
      let json: Record<string, unknown> | null = null
      try {
        json = JSON.parse(text.split('\r\n\r\n')[1] ?? '')
      } catch {
        // an HTML error page of Express, or nothing
      }
      resolve({ status, body: json, reached: json?.reached === true })
    }
    socket.on('data', (chunk) => {
      chunks.push(chunk)
    })
    socket.on('end', finish)
    socket.on('error', finish)
    setTimeout(() => {
      socket.destroy()
      finish()
    }, 2000)
  })
}

async function sendAll(port: number, targets: string[], body?: string): Promise<Answer[]> {
  const answers: Answer[] = []
  for (let i = 0; i < targets.length; i += 25) {
    answers.push(
      ...(await Promise.all(targets.slice(i, i + 25).map((target) => send(port, target, body)))),
    )
  }
  return answers
}

/** Every way to write a request target for `path` that we know of: case, slashes, `#`, `?`, hosts. */
function spellings(path: string): string[] {
  const hosts = [
    '',
    'http://h',
    'http://localhost:9000',
    'HTTP://H',
    'http://',
    'http:///',
    'http://h:99999999',
    'http://h:65536',
    'http://h:abc',
    'http://h@',
    'http://:@',
    'http://h:80@',
    'http://@h',
    'http://user:pa:ss@h:99999',
    'http://[::1',
    'http://h\\',
    'http://h%zz',
    'https://h',
    'foo://h',
  ]
  const paths = [
    path,
    path.toUpperCase(),
    `${path}/`,
    `${path}//`,
    path.replace(/\b[a-z]/g, (c) => c.toUpperCase()),
  ]
  const suffixes = ['', '#x', '?a=1', '/#x', '?a#b']
  const found = new Set<string>()
  for (const host of hosts) {
    for (const candidate of paths)
      for (const suffix of suffixes) found.add(host + candidate + suffix)
  }
  for (const extra of [
    path.replace('/store/', '/store\\'),
    `${path.replace('/store/', '/store\\')}#x`,
    `${path}%`,
    `${path} `,
    `${path};x`,
    `${path}/.`,
    `./${path}`,
    path.replace('/store/', '//store/'),
  ]) {
    found.add(extra)
  }
  return [...found]
}

describe('the route guards decide by the path Express routes by', () => {
  const servers: Server[] = []
  let guarded = 0
  let open = 0

  beforeAll(async () => {
    for (const isGuarded of [true, false]) {
      const server = createServer(buildApp(isGuarded) as never)
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
      servers.push(server)
      if (isGuarded) guarded = (server.address() as AddressInfo).port
      else open = (server.address() as AddressInfo).port
    }
  })

  afterAll(async () => {
    await Promise.all(
      servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
    )
  })

  const CLOSED = { type: 'not_found', message: 'Nie znaleziono.' }

  describe('closedRoutes', () => {
    it('the canonical request, a query and a trailing slash: 404', async () => {
      for (const target of ['/store/widgets', '/store/widgets/', '/store/widgets?x=1']) {
        const answer = await send(guarded, target)
        expect([target, answer.status, answer.body]).toEqual([target, 404, CLOSED])
      }
    })

    it('the neighbours are other routes and are left alone', async () => {
      for (const target of [
        '/store/widgets/claim',
        '/store/widgets/claim/',
        '/store/widgets/claim?x=1',
        '/STORE/WIDGETS/CLAIM',
        '/store/widgets/lookup',
        '/store/widgets/lookup#x',
        '/store/widget-kinds',
      ]) {
        expect([target, (await send(guarded, target)).reached]).toEqual([target, true])
      }
      expect((await send(guarded, '/store/widgetsx')).reached).toBe(false)
    })

    it('the spellings that reached Medusa through the first fix are closed (absolute-form targets)', async () => {
      for (const target of [
        'http:///store/widgets',
        'http://h:99999999/store/widgets',
        'http://h:65536/store/widgets',
        'http://h@/store/widgets',
        'http://:@/store/widgets',
        'http://h:80@/store/widgets',
        'http://user:pa:ss@h:99999/store/widgets',
        'http://localhost:9000/store/widgets',
        '/store/WIDGETS',
        '/Store/Widgets/',
        '/store/widgets#x',
        '/store/widgets/#x',
      ]) {
        const answer = await send(guarded, target)
        expect([target, answer.reached]).toEqual([target, false])
        expect([target, answer.status]).toEqual([target, 404])
      }
    })

    it.each(['/store/widgets', '/auth/customer/emailpass/register'])(
      'no spelling of %s that Express routes to the handler gets past the guard',
      async (path) => {
        const targets = spellings(path)
        const [without, withGuard] = [await sendAll(open, targets), await sendAll(guarded, targets)]

        const reachedOpen = targets.filter((_, i) => without[i]?.reached)
        const leaked = targets.filter((_, i) => withGuard[i]?.reached)
        // The unguarded app is the oracle: these are the targets Express hands to the handler.
        expect(reachedOpen).toEqual(expect.arrayContaining([path, `${path}/`, path.toUpperCase()]))
        expect(leaked).toEqual([])
      },
    )

    it("a guard on another path leaves the closed path's neighbours reachable under every spelling", async () => {
      const targets = spellings('/store/widgets/claim')
      const [without, withGuard] = [await sendAll(open, targets), await sendAll(guarded, targets)]

      const lost = targets.filter((_, i) => without[i]?.reached && !withGuard[i]?.reached)
      expect(lost).toEqual([])
    })
  })

  describe('rejectCustomerMetadata', () => {
    const WITH_METADATA = '{"metadata":{"sessions_valid_from":0}}'
    const REFUSED = { type: 'invalid_data', message: 'Pole metadata jest niedostępne.' }

    it('metadata on the two customer paths: 400, also with a query and a trailing slash', async () => {
      for (const target of [
        '/store/customers',
        '/store/customers/',
        '/store/customers/me',
        '/store/customers/me/',
        '/store/customers/me?x=1',
      ]) {
        const answer = await send(guarded, target, WITH_METADATA)
        expect([target, answer.status, answer.body]).toEqual([target, 400, REFUSED])
      }
    })

    it('without metadata, and on the address routes, the request goes on', async () => {
      expect((await send(guarded, '/store/customers/me', '{"first_name":"Jan"}')).reached).toBe(
        true,
      )
      expect((await send(guarded, '/store/customers/me/addresses', WITH_METADATA)).reached).toBe(
        true,
      )
      expect((await send(guarded, '/store/customers/me/addresses/', WITH_METADATA)).reached).toBe(
        true,
      )
    })

    it('the spellings that reached Medusa through the first fix are refused too', async () => {
      for (const target of [
        'http:///store/customers/me',
        'http://h:99999999/store/customers/me',
        'http://h@/store/customers/me',
        'http:///store/customers',
        'http://h@/store/customers',
        '/STORE/CUSTOMERS/ME',
        '/store/customers/me#x',
      ]) {
        const answer = await send(guarded, target, WITH_METADATA)
        expect([target, answer.reached]).toEqual([target, false])
        expect([target, answer.status]).toEqual([target, 400])
      }
    })

    it.each(['/store/customers', '/store/customers/me'])(
      'no spelling of %s that Express routes to the handler takes metadata past the guard',
      async (path) => {
        const targets = spellings(path)
        const [without, withGuard] = [
          await sendAll(open, targets, WITH_METADATA),
          await sendAll(guarded, targets, WITH_METADATA),
        ]

        const reachedOpen = targets.filter((_, i) => without[i]?.reached)
        const leaked = targets.filter((_, i) => withGuard[i]?.reached)
        expect(reachedOpen).toEqual(expect.arrayContaining([path, `${path}/`, path.toUpperCase()]))
        // `/store/customers/me/addresses`-like spellings are other routes: not in this list.
        expect(leaked).toEqual([])
      },
    )
  })
})

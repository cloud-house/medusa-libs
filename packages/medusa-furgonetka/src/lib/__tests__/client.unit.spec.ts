import type { ParcelSpec, ShipmentReceiver } from '../../types'
import {
  authorizeUrl,
  createFurgonetkaClient,
  exchangeCode,
  FurgonetkaError,
  type PackageInput,
  refreshTokens,
  type Sender,
  toPackageBody,
} from '../client'
import type { FurgonetkaConfig } from '../config'

type Recorded = {
  url: string
  method: string
  headers: Record<string, string>
  text: string | undefined
  body: unknown
}
type Reply = { status?: number; body?: unknown; raw?: string }

function fakeFetch(replies: Reply[] | ((call: Recorded) => Reply)) {
  const calls: Recorded[] = []
  const fetch = async (input: string, init?: RequestInit) => {
    const text = init?.body ? String(init.body) : undefined
    let body: unknown
    try {
      body = text ? JSON.parse(text) : undefined
    } catch {
      body = undefined
    }
    const call: Recorded = {
      url: input,
      method: init?.method ?? 'GET',
      headers: { ...(init?.headers as Record<string, string> | undefined) },
      text,
      body,
    }
    calls.push(call)
    const next = (typeof replies === 'function' ? replies(call) : replies.shift()) ?? { body: {} }
    const status = next.status ?? 200
    if (status === 204) return new Response(null, { status })
    return new Response(next.raw ?? JSON.stringify(next.body ?? {}), { status })
  }
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls }
}

const URL_BASE = 'https://api.sandbox.furgonetka.pl'
const TOKEN = 'secret-access-token-123'
const V1 = 'application/vnd.furgonetka.v1+json'
const V2 = 'application/vnd.furgonetka.v2+json'

function client(fetch: typeof globalThis.fetch, extra: { timeoutMs?: number } = {}) {
  return createFurgonetkaClient({
    url: `${URL_BASE}/`,
    accessToken: async () => TOKEN,
    fetch,
    pollMs: 1,
    pollTimeoutMs: 200,
    ...extra,
  })
}

async function failure(promise: Promise<unknown>): Promise<FurgonetkaError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof FurgonetkaError) return error
    throw error
  }
  throw new Error('expected a FurgonetkaError')
}

const sender: Sender = {
  name: 'Acme Shop Magazyn',
  street: 'Magazynowa 1',
  postal_code: '00-001',
  city: 'Warszawa',
  phone: '+48600100200',
  email: 'sklep@shop.example',
}

const lockerReceiver: ShipmentReceiver = {
  name: 'Jan Kowalski',
  company: null,
  phone: '+48501234567',
  email: 'jan@example.pl',
  street: null,
  postal_code: null,
  city: null,
  point: 'KRA01M',
  point_label: 'Kraków, Długa 1',
}

const courierReceiver: ShipmentReceiver = {
  name: 'Anna Nowak',
  company: 'Nowak S.A.',
  phone: '+48601234567',
  email: null,
  street: 'Floriańska 15',
  postal_code: '31-021',
  city: 'Kraków',
  point: null,
  point_label: null,
}

const board: ParcelSpec = {
  template_id: 'tpl_1',
  name: 'Karton deski',
  kind: 'box',
  length_cm: 95,
  width_cm: 45,
  height_cm: 30,
  weight_g: 15000,
}

const lockerB: ParcelSpec = {
  template_id: null,
  name: 'Paczkomat B',
  kind: 'locker_b',
  length_cm: 64,
  width_cm: 38,
  height_cm: 19,
  weight_g: 2500,
}

const dpdInput: PackageInput = {
  reference: 'CHNS-1001',
  serviceId: 12,
  carrier: 'dpd',
  receiver: courierReceiver,
  sender,
  parcels: [board],
  declaredValueCents: 249999,
  pickup: 'courier',
}

describe('toPackageBody', () => {
  it('sends a parcel locker as a point and no address', () => {
    const body = toPackageBody({
      ...dpdInput,
      carrier: 'inpost_locker',
      receiver: lockerReceiver,
      parcels: [lockerB],
      declaredValueCents: 12345,
    })

    expect(body.receiver).toEqual({
      name: 'Jan Kowalski',
      email: 'jan@example.pl',
      phone: '+48501234567',
      country_code: 'PL',
      point: 'KRA01M',
    })
    for (const field of ['street', 'postcode', 'city', 'company']) {
      expect(body.receiver).not.toHaveProperty(field)
    }
    expect(body).toMatchObject({ service_id: 12, user_reference_number: 'CHNS-1001' })
  })

  it('sends a courier receiver with the address and no point', () => {
    const body = toPackageBody(dpdInput)

    expect(body.receiver).toEqual({
      name: 'Anna Nowak',
      company: 'Nowak S.A.',
      street: 'Floriańska 15',
      postcode: '31-021',
      city: 'Kraków',
      country_code: 'PL',
      phone: '+48601234567',
    })
    expect(body.receiver).not.toHaveProperty('point')
    expect(body.receiver).not.toHaveProperty('email')
  })

  it('takes the sender as the pickup address', () => {
    expect(toPackageBody(dpdInput).pickup).toEqual({
      name: 'Acme Shop Magazyn',
      street: 'Magazynowa 1',
      postcode: '00-001',
      city: 'Warszawa',
      country_code: 'PL',
      phone: '+48600100200',
      email: 'sklep@shop.example',
    })
  })

  it('turns two DPD cartons into two parcels with the length as depth and kilograms', () => {
    const body = toPackageBody({ ...dpdInput, parcels: [board, board] })

    expect(body.parcels).toEqual([
      { width: 45, depth: 95, height: 30, weight: 15, value: 1250, type: 'package' },
      { width: 45, depth: 95, height: 30, weight: 15, value: 1249.99, type: 'package' },
    ])
  })

  it('splits the declared value evenly and puts the odd grosze on the first parcel', () => {
    const parcels = toPackageBody({
      ...dpdInput,
      parcels: [board, board, board],
      declaredValueCents: 1000,
    }).parcels as { value: number }[]

    expect(parcels.map((parcel) => parcel.value)).toEqual([3.34, 3.33, 3.33])
  })

  it('sends a drop-off as an „any point” for the carrier', () => {
    const inpost = toPackageBody({
      ...dpdInput,
      carrier: 'inpost_locker',
      receiver: lockerReceiver,
      parcels: [lockerB],
      pickup: 'drop_off',
    })
    const dpd = toPackageBody({ ...dpdInput, pickup: 'drop_off' })
    const courier = toPackageBody({ ...dpdInput, carrier: 'inpost_courier', pickup: 'drop_off' })

    expect(inpost.pickup).toMatchObject({ street: 'Magazynowa 1', point: 'any_apm' })
    expect(dpd.pickup).toMatchObject({ street: 'Magazynowa 1', point: 'any_parcel_shop' })
    expect(courier.pickup).toMatchObject({ point: 'any_apm' })
    expect(toPackageBody(dpdInput).pickup).not.toHaveProperty('point')
  })

  it('leaves the sender e-mail out when there is none', () => {
    const body = toPackageBody({ ...dpdInput, sender: { ...sender, email: null } })

    expect(body.pickup).not.toHaveProperty('email')
  })
})

describe('createFurgonetkaClient', () => {
  it('creates a package with the v2 headers and the bearer token', async () => {
    const { fetch, calls } = fakeFetch([{ body: { package_id: 501, state: 'waiting' } }])

    const result = await client(fetch).createPackage(dpdInput)

    expect(result).toEqual({ packageId: '501' })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      url: `${URL_BASE}/packages`,
      method: 'POST',
      headers: { Accept: V2, 'Content-Type': V2, Authorization: `Bearer ${TOKEN}` },
      body: toPackageBody(dpdInput),
    })
  })

  it('lists the services of the account', async () => {
    const { fetch, calls } = fakeFetch([
      {
        body: {
          services: [
            { id: 12, service: 'dpd', name: 'DPD', owner: 'furgonetka' },
            { id: 13, service: 'inpost', name: 'InPost', owner: 'client' },
          ],
        },
      },
    ])

    const services = await client(fetch).services()

    expect(services).toEqual([
      { id: 12, service: 'dpd', owner: 'furgonetka' },
      { id: 13, service: 'inpost', owner: 'client' },
    ])
    expect(calls[0]).toMatchObject({
      url: `${URL_BASE}/account/services`,
      method: 'GET',
      headers: { Accept: V1, Authorization: `Bearer ${TOKEN}` },
    })
  })

  it('describes the account by the current company, else by the owner e-mail', async () => {
    const company = fakeFetch([
      {
        body: {
          companies: [
            { name: 'Inna Firma', actual: false },
            { name: 'Acme Shop Sp. z o.o.', actual: true },
          ],
        },
      },
    ])
    expect(await client(company.fetch).account()).toEqual({ label: 'Acme Shop Sp. z o.o.' })
    expect(company.calls[0]?.url).toBe(`${URL_BASE}/account/companies`)

    const owner = fakeFetch([
      { body: { companies: [] } },
      {
        body: {
          members: [
            { email: 'ktos@shop.example', owner: false },
            { email: 'wlasciciel@shop.example', owner: true },
          ],
        },
      },
    ])
    expect(await client(owner.fetch).account()).toEqual({ label: 'wlasciciel@shop.example' })
    expect(owner.calls[1]?.url).toBe(`${URL_BASE}/account/members`)

    const nobody = fakeFetch([{ body: { companies: [] } }, { body: { members: [] } }])
    expect(await client(nobody.fetch).account()).toEqual({ label: 'Konto Furgonetki' })
  })

  it('reads the package: numbers, tracking links, cost in grosze and the flags', async () => {
    const { fetch, calls } = fakeFetch([
      {
        body: {
          package_id: '501',
          state: 'ordered',
          user_reference_number: 'CHNS-1001',
          parcels: [
            {
              package_no: '0000123456789U',
              tracking_url: 'https://tracktrace.dpd.com.pl/parcelDetails?typ=1&p1=0000123456789U',
            },
            { package_no: null, tracking_url: null },
            { package_no: '0000123456790U', tracking_url: null },
          ],
          pricing: { price_gross: '23.45' },
          cancel_available: true,
          pickup_available: false,
        },
      },
    ])

    const info = await client(fetch).getPackage('501')

    expect(info).toEqual({
      packageId: '501',
      state: 'ordered',
      reference: 'CHNS-1001',
      tracking: [
        {
          number: '0000123456789U',
          url: 'https://tracktrace.dpd.com.pl/parcelDetails?typ=1&p1=0000123456789U',
        },
        { number: '0000123456790U', url: null },
      ],
      costCents: 2345,
      cancelAvailable: true,
      pickupAvailable: false,
    })
    expect(calls[0]).toMatchObject({
      url: `${URL_BASE}/packages/501`,
      method: 'GET',
      headers: { Accept: V2 },
    })
  })

  it('reads a numeric price and tolerates a package without price or flags', async () => {
    const { fetch } = fakeFetch([
      { body: { package_id: 7, state: 'ordered', pricing: { price_gross: 23.45 }, parcels: [] } },
      { body: { package_id: 8, state: 'waiting' } },
    ])

    expect(await client(fetch).getPackage('7')).toMatchObject({ costCents: 2345 })
    expect(await client(fetch).getPackage('8')).toEqual({
      packageId: '8',
      state: 'waiting',
      reference: null,
      tracking: [],
      costCents: null,
      cancelAvailable: false,
      pickupAvailable: false,
    })
  })

  it('finds a package by the exact reference and skips cancelled ones', async () => {
    const { fetch, calls } = fakeFetch([
      {
        body: {
          packages: [
            { package_id: '1', user_reference_number: 'CHNS-10010', state: 'ordered', parcels: [] },
            {
              package_id: '2',
              user_reference_number: 'CHNS-1001',
              state: 'cancelled',
              parcels: [],
            },
            { package_id: '3', user_reference_number: 'CHNS-1001', state: 'waiting', parcels: [] },
          ],
        },
      },
      {
        body: { packages: [{ package_id: '4', user_reference_number: 'CHNS-10010', parcels: [] }] },
      },
    ])

    const found = await client(fetch).findPackage('CHNS-1001')
    const missing = await client(fetch).findPackage('CHNS-1001')

    expect(found?.packageId).toBe('3')
    expect(missing).toBeNull()
    const url = new URL(calls[0]?.url ?? '')
    expect(url.pathname).toBe('/packages')
    expect(url.searchParams.get('list_type')).toBe('all')
    expect(url.searchParams.get('query')).toBe('CHNS-1001')
    expect(calls[0]?.headers.Accept).toBe(V2)
  })

  it('deletes an unordered package and treats „not found” as done', async () => {
    const { fetch, calls } = fakeFetch([{ status: 204 }, { status: 404, body: {} }])

    await client(fetch).deletePackage('7')
    await client(fetch).deletePackage('7')

    expect(calls[0]).toMatchObject({ url: `${URL_BASE}/packages/7`, method: 'DELETE' })
  })

  it('does not hide other errors of a delete', async () => {
    const { fetch } = fakeFetch([
      { status: 400, body: { errors: [{ path: '/', message: 'Paczka jest zamówiona' }] } },
    ])

    const error = await failure(client(fetch).deletePackage('7'))

    expect(error.kind).toBe('permanent')
    expect(error.message).toContain('Paczka jest zamówiona')
  })

  describe('orderPackages', () => {
    it('puts the command and polls it until it is successful', async () => {
      const { fetch, calls } = fakeFetch([
        { body: { uuid: 'u1' } },
        { body: { status: 'queueing' } },
        { body: { status: 'running' } },
        { body: { status: 'successful', successfully_ordered_packages: [7] } },
      ])

      const result = await client(fetch).orderPackages('u1', ['7'])

      expect(result).toEqual({ status: 'successful', ordered: ['7'], errors: [] })
      expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
        `PUT ${URL_BASE}/order-commands/u1`,
        `GET ${URL_BASE}/order-commands/u1`,
        `GET ${URL_BASE}/order-commands/u1`,
        `GET ${URL_BASE}/order-commands/u1`,
      ])
      expect(calls[0]).toMatchObject({
        headers: { Accept: V1, 'Content-Type': V1, Authorization: `Bearer ${TOKEN}` },
        body: {
          packages: [{ id: '7' }],
          label: { file_format: 'pdf', page_format: 'a6' },
        },
      })
    })

    it('returns the packages the carrier refused next to the ordered ones', async () => {
      const { fetch } = fakeFetch([
        { body: { uuid: 'u2' } },
        {
          body: {
            status: 'partial_success',
            successfully_ordered_packages: [7],
            errors: [
              {
                path: '/packages/id/8',
                message: 'Przewoźnik odrzucił przesyłkę',
                code: 'carrierValidationError',
              },
            ],
          },
        },
      ])

      const result = await client(fetch).orderPackages('u2', ['7', '8'])

      expect(result).toEqual({
        status: 'partial_success',
        ordered: ['7'],
        errors: [
          {
            packageId: '8',
            message: 'Przewoźnik odrzucił przesyłkę',
            code: 'carrierValidationError',
          },
        ],
      })
    })

    it('returns a batch the balance covered only in part: the paid packages and the balance error', async () => {
      const { fetch } = fakeFetch([
        { body: { uuid: 'u9' } },
        {
          body: {
            status: 'partial_success',
            successfully_ordered_packages: [7, 8],
            errors: [{ path: '/packages', message: 'Saldo konta jest zbyt niskie' }],
          },
        },
      ])

      // Two packages are paid and have labels: a throw would fail their rows too.
      const result = await client(fetch).orderPackages('u9', ['7', '8', '9'])

      expect(result).toEqual({
        status: 'partial_success',
        ordered: ['7', '8'],
        errors: [
          {
            packageId: null,
            message: 'Brak środków na koncie Furgonetki – doładuj saldo i spróbuj ponownie',
            code: null,
          },
        ],
      })
    })

    it('returns a command that failed for every package', async () => {
      const { fetch } = fakeFetch([
        { body: { uuid: 'u3' } },
        {
          body: {
            status: 'error',
            errors: [{ path: '/packages/id/8', message: 'Nieprawidłowy kod pocztowy' }],
          },
        },
      ])

      const result = await client(fetch).orderPackages('u3', ['8'])

      expect(result).toEqual({
        status: 'error',
        ordered: [],
        errors: [{ packageId: '8', message: 'Nieprawidłowy kod pocztowy', code: null }],
      })
    })

    it('reports a command that only lost the connection to the carrier as transient', async () => {
      const { fetch } = fakeFetch([
        { body: { uuid: 'u4' } },
        {
          body: {
            status: 'error',
            errors: [
              {
                path: '/packages/id/8',
                message: 'Brak połączenia',
                code: 'carrierConnectionError',
              },
            ],
          },
        },
      ])

      const error = await failure(client(fetch).orderPackages('u4', ['8']))

      expect(error.kind).toBe('transient')
    })

    it('reports a balance error of the command as „no funds”', async () => {
      const { fetch } = fakeFetch([
        { body: { uuid: 'u5' } },
        {
          body: {
            status: 'error',
            errors: [{ path: '/packages', message: 'Saldo konta jest zbyt niskie' }],
          },
        },
      ])

      const error = await failure(client(fetch).orderPackages('u5', ['8']))

      expect(error.kind).toBe('no_funds')
      expect(error.message).toBe(
        'Brak środków na koncie Furgonetki – doładuj saldo i spróbuj ponownie',
      )
    })

    it('reports a balance error answered with 400 as „no funds” too', async () => {
      const { fetch } = fakeFetch([
        {
          status: 400,
          body: {
            errors: [{ path: '/packages', message: 'Brak wystarczających środków na koncie' }],
          },
        },
      ])

      const error = await failure(client(fetch).orderPackages('u6', ['8']))

      expect([error.kind, error.status]).toEqual(['no_funds', 400])
      expect(error.message).toContain('Brak środków na koncie Furgonetki')
    })

    it('does not take another error on /packages for a balance error', async () => {
      const { fetch } = fakeFetch([
        {
          status: 400,
          body: { errors: [{ path: '/packages', message: 'Nie wybrano przesyłek' }] },
        },
      ])

      const error = await failure(client(fetch).orderPackages('u7', []))

      expect(error.kind).toBe('permanent')
      expect(error.message).toBe('/packages: Nie wybrano przesyłek')
    })

    it('reports an error of the whole command as permanent with its text', async () => {
      const { fetch } = fakeFetch([
        { body: { uuid: 'u8' } },
        {
          body: {
            status: 'error',
            errors: [{ path: '/phone', message: 'Zweryfikuj numer telefonu' }],
          },
        },
      ])

      const error = await failure(client(fetch).orderPackages('u8', ['8']))

      expect(error.kind).toBe('permanent')
      expect(error.message).toBe('/phone: Zweryfikuj numer telefonu')
    })

    it('goes on polling when the command id exists already (400 commandExists)', async () => {
      const exists = {
        status: 400,
        body: {
          errors: [{ path: '/uuid', message: 'Operacja już istnieje', code: 'commandExists' }],
        },
      }
      const { fetch, calls } = fakeFetch([
        exists,
        { body: { status: 'successful', successfully_ordered_packages: [7] } },
      ])

      const result = await client(fetch).orderPackages('u1', ['7'])

      expect(result).toEqual({ status: 'successful', ordered: ['7'], errors: [] })
      expect(calls.map((call) => call.method)).toEqual(['PUT', 'GET'])
    })

    it('takes a flat 400 with the code commandExists as accepted too', async () => {
      const { fetch } = fakeFetch([
        { status: 400, body: { code: 'commandExists', message: 'Operacja już istnieje' } },
        { body: { status: 'successful', successfully_ordered_packages: [7] } },
      ])

      const result = await client(fetch).orderPackages('u1', ['7'])

      expect(result.ordered).toEqual(['7'])
    })

    it('does not take another 400 on the command for an accepted one', async () => {
      const { fetch, calls } = fakeFetch([
        {
          status: 400,
          body: { errors: [{ path: '/packages', message: 'Nie wybrano przesyłek' }] },
        },
      ])

      const error = await failure(client(fetch).orderPackages('u1', []))

      expect(error.kind).toBe('permanent')
      expect(calls).toHaveLength(1)
    })

    it('can retry with the same command id after a timeout of the PUT', async () => {
      let puts = 0
      const flaky = ((_input: string, init?: RequestInit) => {
        if (init?.method === 'PUT') {
          puts++
          if (puts === 1) {
            // the first PUT hangs: the outcome is unknown
            return new Promise((_resolve, reject) => {
              init.signal?.addEventListener('abort', () => reject(init.signal?.reason))
            })
          }
          return Promise.resolve(
            new Response(
              JSON.stringify({ errors: [{ path: '/uuid', message: 'x', code: 'commandExists' }] }),
              { status: 400 },
            ),
          )
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({ status: 'successful', successfully_ordered_packages: [7] }),
          ),
        )
      }) as unknown as typeof globalThis.fetch
      const furgonetka = client(flaky, { timeoutMs: 20 })

      const first = await failure(furgonetka.orderPackages('u1', ['7']))
      const retry = await furgonetka.orderPackages('u1', ['7'])

      expect(first.kind).toBe('transient')
      expect(retry).toEqual({ status: 'successful', ordered: ['7'], errors: [] })
    })

    it('gives up on a command that stays in the queue as transient', async () => {
      const { fetch, calls } = fakeFetch((call) =>
        call.method === 'PUT' ? { body: { uuid: 'u9' } } : { body: { status: 'queueing' } },
      )

      const error = await failure(
        createFurgonetkaClient({
          url: URL_BASE,
          accessToken: async () => TOKEN,
          fetch,
          pollMs: 1,
          pollTimeoutMs: 25,
        }).orderPackages('u9', ['8']),
      )

      expect(error.kind).toBe('transient')
      expect(calls.length).toBeGreaterThan(2)
    })
  })

  describe('labels', () => {
    it('orders the documents, polls and downloads the file without the token', async () => {
      const signed = 'https://files.furgonetka.pl/labels/abc.pdf?signature=xyz'
      const { fetch, calls } = fakeFetch([
        { body: { uuid: 'x' } },
        { body: { status: 'running' } },
        { body: { status: 'successful', url: signed } },
        { raw: '%PDF-1.4 labels' },
      ])

      const pdf = await client(fetch).labels(['7', '8'])

      expect(Buffer.isBuffer(pdf)).toBe(true)
      expect(pdf.toString()).toBe('%PDF-1.4 labels')
      expect(calls[0]?.method).toBe('PUT')
      expect(calls[0]?.url).toMatch(new RegExp(`^${URL_BASE}/documents-command/[0-9a-f-]{36}$`))
      expect(calls[0]?.body).toEqual({
        packages: [{ id: '7' }, { id: '8' }],
        documents_types: ['labels'],
        label: { page_format: 'a6' },
      })
      expect(calls[1]?.url).toBe(calls[0]?.url)
      expect(calls[2]?.method).toBe('GET')
      expect(calls[3]?.url).toBe(signed)
      expect(calls[3]?.headers.Authorization).toBeUndefined()
    })

    it('fails when the documents command ends without a file', async () => {
      const { fetch } = fakeFetch([
        { body: {} },
        {
          body: { status: 'error', errors: [{ path: '/packages/id/7', message: 'Brak etykiety' }] },
        },
      ])

      const error = await failure(client(fetch).labels(['7']))

      expect(error.kind).toBe('permanent')
      expect(error.message).toContain('Brak etykiety')
    })

    it('downloads one label as an A6 PDF', async () => {
      const { fetch, calls } = fakeFetch([{ raw: '%PDF-1.4 one' }])

      const pdf = await client(fetch).label('7')

      expect(pdf.toString()).toBe('%PDF-1.4 one')
      const url = new URL(calls[0]?.url ?? '')
      expect(url.pathname).toBe('/packages/7/label')
      expect(url.searchParams.get('label[page_format]')).toBe('a6')
      expect(calls[0]?.headers.Authorization).toBe(`Bearer ${TOKEN}`)
    })

    it('treats a label that is not ready (204) as transient', async () => {
      const { fetch } = fakeFetch([{ status: 204 }])

      const error = await failure(client(fetch).label('7'))

      expect(error.kind).toBe('transient')
      expect(error.message).toContain('Etykieta')
    })
  })

  describe('orderPickup', () => {
    const window = { date: '2026-11-04', from: '10:00', to: '15:00' }
    const proposals = (id: string, rows: [string, string, string, boolean][]) => ({
      package_id: id,
      proposals: rows.map(([date, min_time, max_time, available]) => ({
        date,
        min_time,
        max_time,
        available,
      })),
    })

    it('trims the window to the available proposal and orders the pickup', async () => {
      const { fetch, calls } = fakeFetch([
        {
          body: {
            packages: [
              proposals('7', [
                ['2026-11-04', '09:00', '10:00', false],
                ['2026-11-04', '11:00', '14:00', true],
                ['2026-11-05', '10:00', '15:00', true],
              ]),
            ],
          },
        },
        { body: { uuid: 'p' } },
        {
          body: {
            status: 'successful',
            pickup_details: [{ pickup_id: 'NR123', package_ids: [7] }],
          },
        },
      ])

      const result = await client(fetch).orderPickup(['7'], window)

      expect(result).toEqual({
        ordered: [{ packageId: '7', pickupId: 'NR123', from: '11:00', to: '14:00' }],
        failed: [],
      })
      expect(calls[0]).toMatchObject({
        url: `${URL_BASE}/packages/pickup-date-proposals`,
        method: 'POST',
        headers: { Accept: V1, 'Content-Type': V1 },
        body: { packages: [{ id: '7' }], ready_date: '2026-11-04' },
      })
      expect(calls[1]?.method).toBe('PUT')
      expect(calls[1]?.url).toMatch(new RegExp(`^${URL_BASE}/pickup-commands/[0-9a-f-]{36}$`))
      expect(calls[1]?.body).toEqual({
        packages: [{ id: '7' }],
        pickup_date: { date: '2026-11-04', min_time: '11:00', max_time: '14:00' },
      })
    })

    it('keeps the requested window when the proposal covers it', async () => {
      const { fetch, calls } = fakeFetch([
        { body: { packages: [proposals('7', [['2026-11-04', '08:00:00', '17:00:00', true]])] } },
        { body: {} },
        {
          body: { status: 'successful', pickup_details: [{ pickup_id: 'NR1', package_ids: [7] }] },
        },
      ])

      const result = await client(fetch).orderPickup(['7'], window)

      expect(result.ordered).toEqual([
        { packageId: '7', pickupId: 'NR1', from: '10:00', to: '15:00' },
      ])
      expect(calls[1]?.body).toMatchObject({
        pickup_date: { min_time: '10:00', max_time: '15:00' },
      })
    })

    it('reports a day without an available proposal and orders nothing', async () => {
      const { fetch, calls } = fakeFetch([
        {
          body: {
            packages: [
              proposals('7', [
                ['2026-11-04', '10:00', '15:00', false],
                ['2026-11-05', '10:00', '15:00', true],
              ]),
            ],
          },
        },
      ])

      const result = await client(fetch).orderPickup(['7'], window)

      expect(result).toEqual({
        ordered: [],
        failed: [
          {
            packageId: '7',
            message: 'Brak terminu odbioru na śr 4 lis, 10:00–15:00 – wybierz inny dzień',
          },
        ],
      })
      expect(calls).toHaveLength(1)
    })

    it('orders the packages that have a term and fails the others', async () => {
      const { fetch, calls } = fakeFetch([
        {
          body: {
            packages: [
              proposals('7', [['2026-11-04', '10:00', '15:00', true]]),
              proposals('8', []),
            ],
          },
        },
        { body: {} },
        {
          body: { status: 'successful', pickup_details: [{ pickup_id: 'NR9', package_ids: [7] }] },
        },
      ])

      const result = await client(fetch).orderPickup(['7', '8'], window)

      expect(result.ordered).toEqual([
        { packageId: '7', pickupId: 'NR9', from: '10:00', to: '15:00' },
      ])
      expect(result.failed.map((row) => row.packageId)).toEqual(['8'])
      expect(calls[1]?.body).toMatchObject({ packages: [{ id: '7' }] })
    })

    describe('with two terms (two commands)', () => {
      // 7 can be picked up 10:00-15:00, 8 only 11:00-14:00: two groups, two commands.
      const twoTerms = {
        body: {
          packages: [
            proposals('7', [['2026-11-04', '10:00', '15:00', true]]),
            proposals('8', [['2026-11-04', '11:00', '14:00', true]]),
          ],
        },
      }
      const booked = (id: number, pickup: string) => ({
        body: { status: 'successful', pickup_details: [{ pickup_id: pickup, package_ids: [id] }] },
      })

      it('keeps the pickup of the first group when the second command fails', async () => {
        const { fetch, calls } = fakeFetch([
          twoTerms,
          { body: {} },
          booked(7, 'NR1'),
          { status: 503, body: {} },
        ])

        const result = await client(fetch).orderPickup(['7', '8'], window)

        expect(result).toEqual({
          ordered: [{ packageId: '7', pickupId: 'NR1', from: '10:00', to: '15:00' }],
          failed: [{ packageId: '8', message: 'Furgonetka nie odpowiada (HTTP 503).' }],
        })
        expect(calls.filter((call) => call.method === 'PUT')).toHaveLength(2)
      })

      it('keeps the pickup of the second group when the first command fails', async () => {
        const { fetch } = fakeFetch([
          twoTerms,
          { status: 409, body: { code: 'terms_and_conditions_not_valid', message: 'x' } },
          { body: {} },
          booked(8, 'NR2'),
        ])

        const result = await client(fetch).orderPickup(['7', '8'], window)

        expect(result.ordered).toEqual([
          { packageId: '8', pickupId: 'NR2', from: '11:00', to: '14:00' },
        ])
        expect(result.failed).toEqual([
          {
            packageId: '7',
            message: 'Zaakceptuj regulaminy przewoźników w panelu Furgonetki i spróbuj ponownie.',
          },
        ])
      })

      it('throws when no group booked anything', async () => {
        const { fetch } = fakeFetch([
          twoTerms,
          { status: 503, body: {} },
          { status: 409, body: { code: 'terms_and_conditions_not_valid', message: 'x' } },
        ])

        const error = await failure(client(fetch).orderPickup(['7', '8'], window))

        expect(error.kind).toBe('transient')
      })

      it('throws when the only command fails', async () => {
        const { fetch } = fakeFetch([
          { body: { packages: [proposals('7', [['2026-11-04', '10:00', '15:00', true]])] } },
          { status: 503, body: {} },
        ])

        const error = await failure(client(fetch).orderPickup(['7'], window))

        expect(error.kind).toBe('transient')
      })
    })

    it('throws when the proposals call fails, before anything is booked', async () => {
      const { fetch, calls } = fakeFetch([{ status: 503, body: {} }])

      const error = await failure(client(fetch).orderPickup(['7'], window))

      expect(error.kind).toBe('transient')
      expect(calls).toHaveLength(1)
    })

    it('fails the packages of a pickup command that ended with an error', async () => {
      const { fetch } = fakeFetch([
        { body: { packages: [proposals('7', [['2026-11-04', '10:00', '15:00', true]])] } },
        { body: {} },
        {
          body: {
            status: 'error',
            errors: [{ path: '/packages/id/7', message: 'Odbiór niemożliwy' }],
          },
        },
      ])

      const result = await client(fetch).orderPickup(['7'], window)

      expect(result).toEqual({
        ordered: [],
        failed: [{ packageId: '7', message: 'Odbiór niemożliwy' }],
      })
    })
  })

  it('cancels packages and reports each one', async () => {
    const { fetch, calls } = fakeFetch([
      { body: {} },
      {
        body: {
          status: 'partial_success',
          cancel_command_details: [
            { package_id: 7, cancel_success: true },
            { package_id: 8, cancel_success: false },
          ],
        },
      },
    ])

    const result = await client(fetch).cancelPackages(['7', '8', '9'])

    expect(result).toEqual([
      { packageId: '7', ok: true },
      { packageId: '8', ok: false },
      { packageId: '9', ok: false },
    ])
    expect(calls[0]?.method).toBe('PUT')
    expect(calls[0]?.url).toMatch(new RegExp(`^${URL_BASE}/cancel-command/[0-9a-f-]{36}$`))
    expect(calls[0]?.body).toEqual({ packages: [{ id: '7' }, { id: '8' }, { id: '9' }] })
  })

  it('flattens the tracking of all parcels and sorts it by time', async () => {
    const { fetch, calls } = fakeFetch([
      {
        body: {
          parcels: {
            '0000A': {
              tracking: [
                {
                  state: 'delivered',
                  status: 'Doręczona',
                  datetime: '2026-11-05T10:00:00+01:00',
                  branch: 'Kraków',
                },
                {
                  state: 'collected',
                  status: 'Odebrana od nadawcy',
                  datetime: '2026-11-04T12:00:00+01:00',
                  branch: '',
                },
              ],
            },
            '0000B': {
              tracking: [{ state: 'transit', status: null, datetime: '2026-11-04T20:00:00+01:00' }],
            },
          },
        },
      },
    ])

    const events = await client(fetch).tracking('7')

    expect(events).toEqual([
      { state: 'collected', at: '2026-11-04T12:00:00+01:00', label: 'Odebrana od nadawcy' },
      { state: 'transit', at: '2026-11-04T20:00:00+01:00', label: null },
      { state: 'delivered', at: '2026-11-05T10:00:00+01:00', label: 'Doręczona' },
    ])
    expect(calls[0]).toMatchObject({
      url: `${URL_BASE}/packages/7/tracking`,
      headers: { Accept: V2 },
    })
  })

  it('returns no events for a package nobody scanned', async () => {
    const { fetch } = fakeFetch([{ body: { parcels: {} } }])

    expect(await client(fetch).tracking('7')).toEqual([])
  })

  describe('errors', () => {
    it('treats server errors, throttling and a lost connection as transient', async () => {
      for (const status of [503, 500, 429, 408]) {
        const { fetch } = fakeFetch([{ status, body: { message: 'x' } }])
        const error = await failure(client(fetch).createPackage(dpdInput))
        expect([error.kind, error.status]).toEqual(['transient', status])
      }
      const offline = (async () => {
        throw new TypeError('fetch failed')
      }) as unknown as typeof globalThis.fetch
      const error = await failure(client(offline).createPackage(dpdInput))
      expect(error.kind).toBe('transient')
      expect(error.status).toBeNull()
    })

    it('gives up waiting after the timeout as a transient error', async () => {
      const hanging = ((_input: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
        })) as unknown as typeof globalThis.fetch

      const error = await failure(client(hanging, { timeoutMs: 20 }).createPackage(dpdInput))

      expect(error.kind).toBe('transient')
      expect(error.message).toContain('nie odpowiedziała')
    })

    it('maps 401 to auth and 404 to not found', async () => {
      const unauthorized = fakeFetch([
        { status: 401, body: { code: 'unauthorized', message: 'x' } },
      ])
      const auth = await failure(client(unauthorized.fetch).getPackage('7'))
      expect([auth.kind, auth.status]).toEqual(['auth', 401])

      const missing = fakeFetch([{ status: 404, body: {} }])
      const notFound = await failure(client(missing.fetch).getPackage('7'))
      expect([notFound.kind, notFound.status]).toEqual(['not_found', 404])
    })

    it('tells the operator to accept the carrier terms on 409', async () => {
      const { fetch } = fakeFetch([
        {
          status: 409,
          body: { code: 'terms_and_conditions_not_valid', message: 'Terms not accepted' },
        },
      ])

      const error = await failure(client(fetch).orderPackages('u1', ['7']))

      expect([error.kind, error.status]).toEqual(['terms', 409])
      expect(error.message).toBe(
        'Zaakceptuj regulaminy przewoźników w panelu Furgonetki i spróbuj ponownie.',
      )
    })

    it('treats another 409 as permanent', async () => {
      const { fetch } = fakeFetch([{ status: 409, body: { code: 'other', message: 'Konflikt' } }])

      const error = await failure(client(fetch).orderPackages('u1', ['7']))

      expect(error.kind).toBe('permanent')
      expect(error.message).toContain('Konflikt')
    })

    it('flattens validation errors into one line', async () => {
      const { fetch } = fakeFetch([
        {
          status: 400,
          body: {
            errors: [
              { path: '/receiver/postcode', message: 'Nieprawidłowy kod' },
              { path: '/parcels/0/weight', message: 'Za duża waga' },
              { message: 'Coś jeszcze' },
            ],
          },
        },
      ])

      const error = await failure(client(fetch).createPackage(dpdInput))

      expect([error.kind, error.status]).toEqual(['permanent', 400])
      expect(error.message).toBe(
        '/receiver/postcode: Nieprawidłowy kod; /parcels/0/weight: Za duża waga; Coś jeszcze',
      )
    })

    it('never puts the token into an error message', async () => {
      const bodies = fakeFetch([
        { status: 401, body: { message: `Zły token ${TOKEN}` } },
        { status: 400, body: { errors: [{ path: '/x', message: `Token ${TOKEN} jest zły` }] } },
      ])
      const first = await failure(client(bodies.fetch).getPackage('7'))
      const second = await failure(client(bodies.fetch).createPackage(dpdInput))
      const leaking = (async () => {
        throw new TypeError(`connect ECONNREFUSED with ${TOKEN}`)
      }) as unknown as typeof globalThis.fetch
      const third = await failure(client(leaking).getPackage('7'))

      for (const error of [first, second, third]) {
        expect(error.message).not.toContain(TOKEN)
        expect(JSON.stringify(error)).not.toContain(TOKEN)
      }
      expect(second.message).toContain('***')
    })

    it('keeps the error of the token provider as it is', async () => {
      const broken = createFurgonetkaClient({
        url: URL_BASE,
        accessToken: async () => {
          throw new FurgonetkaError('auth', 'Połączenie z Furgonetką wygasło')
        },
        fetch: fakeFetch([]).fetch,
      })

      const error = await failure(broken.getPackage('7'))

      expect(error.kind).toBe('auth')
      expect(error.message).toBe('Połączenie z Furgonetką wygasło')
    })
  })
})

describe('OAuth', () => {
  const config: FurgonetkaConfig = {
    client: 'api',
    url: URL_BASE,
    clientId: 'app-1',
    clientSecret: 'sec-1',
    webhookToken: null,
    pickupHours: { from: '10:00', to: '15:00' },
    pickupTodayUntil: '12:00',
    adminUrl: 'https://api.shop.example/app',
  }
  const redirect = 'https://api.shop.example/admin/furgonetka/callback'
  const tokenBody = { access_token: 'acc-1', refresh_token: 'ref-1', expires_in: 2678400 }

  it('builds the authorization address', () => {
    const url = new URL(authorizeUrl(config, 'state-1', redirect))

    expect(`${url.origin}${url.pathname}`).toBe(`${URL_BASE}/oauth/authorize`)
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      client_id: 'app-1',
      redirect_uri: redirect,
      state: 'state-1',
      scope: 'api',
    })
  })

  it('exchanges the code with the Basic header and a form', async () => {
    const { fetch, calls } = fakeFetch([{ body: tokenBody }])
    const before = Date.now()

    const tokens = await exchangeCode(config, 'code-1', redirect, fetch)

    const after = Date.now()
    expect(tokens.accessToken).toBe('acc-1')
    expect(tokens.refreshToken).toBe('ref-1')
    const month = 2678400 * 1000
    expect(tokens.accessExpiresAt.getTime()).toBeGreaterThanOrEqual(before + month)
    expect(tokens.accessExpiresAt.getTime()).toBeLessThanOrEqual(after + month)
    expect(month).toBe(31 * 24 * 3600 * 1000)
    expect(calls[0]).toMatchObject({
      url: `${URL_BASE}/oauth/token`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from('app-1:sec-1').toString('base64')}`,
      },
    })
    expect(Object.fromEntries(new URLSearchParams(calls[0]?.text))).toEqual({
      grant_type: 'authorization_code',
      code: 'code-1',
      redirect_uri: redirect,
    })
  })

  it('refreshes with the refresh token', async () => {
    const { fetch, calls } = fakeFetch([{ body: { ...tokenBody, access_token: 'acc-2' } }])

    const tokens = await refreshTokens(config, 'ref-0', fetch)

    expect(tokens).toMatchObject({ accessToken: 'acc-2', refreshToken: 'ref-1' })
    expect(Object.fromEntries(new URLSearchParams(calls[0]?.text))).toEqual({
      grant_type: 'refresh_token',
      refresh_token: 'ref-0',
    })
  })

  it('reports a spent refresh token and wrong application keys as auth', async () => {
    const spent = fakeFetch([
      { status: 400, body: { error: 'invalid_grant', hint: 'Token has been revoked' } },
    ])
    const first = await failure(refreshTokens(config, 'ref-0', spent.fetch))
    expect([first.kind, first.status]).toEqual(['auth', 400])

    const wrongApp = fakeFetch([{ status: 401, body: { error: 'invalid_client' } }])
    const second = await failure(exchangeCode(config, 'code-1', redirect, wrongApp.fetch))
    expect(second.kind).toBe('auth')
  })

  it('reports an outage of the token endpoint as transient and never leaks the secret', async () => {
    const down = fakeFetch([{ status: 503, body: {} }])
    expect((await failure(refreshTokens(config, 'ref-0', down.fetch))).kind).toBe('transient')

    const leaking = (async () => {
      throw new TypeError('fetch failed for sec-1 and ref-0')
    }) as unknown as typeof globalThis.fetch
    const error = await failure(refreshTokens(config, 'ref-0', leaking))
    expect(error.kind).toBe('transient')
    expect(error.message).not.toContain('sec-1')
    expect(error.message).not.toContain('ref-0')
  })

  it('fails on a response without tokens', async () => {
    const { fetch } = fakeFetch([{ body: { access_token: 'acc-1' } }])

    const error = await failure(refreshTokens(config, 'ref-0', fetch))

    expect(error.kind).toBe('permanent')
  })
})

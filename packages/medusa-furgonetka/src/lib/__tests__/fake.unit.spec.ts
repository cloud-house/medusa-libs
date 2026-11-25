import { createHash } from 'node:crypto'
import type { ParcelSpec, ShipmentReceiver } from '../../types'
import {
  authorizeUrl,
  exchangeCode,
  FurgonetkaError,
  type PackageInput,
  refreshTokens,
} from '../client'
import type { FurgonetkaConfig } from '../config'
import {
  createFakeClient,
  fakeFurgonetka,
  markDelivered,
  markPickedUp,
  markReturned,
  webhookBody,
} from '../fake'
import { sampleLabels } from '../label-pdf'

const receiver: ShipmentReceiver = {
  name: 'Anna Nowak',
  company: null,
  phone: '+48601234567',
  email: 'anna@example.pl',
  street: 'Floriańska 15',
  postal_code: '31-021',
  city: 'Kraków',
  point: null,
  point_label: null,
}

const board: ParcelSpec = {
  template_id: null,
  name: 'Karton deski',
  kind: 'box',
  length_cm: 95,
  width_cm: 45,
  height_cm: 30,
  weight_g: 15000,
}

const input = (over: Partial<PackageInput> = {}): PackageInput => ({
  reference: 'CHNS-1001',
  serviceId: 1001,
  carrier: 'dpd',
  receiver,
  sender: {
    name: 'Acme Shop Magazyn',
    street: 'Magazynowa 1',
    postal_code: '00-001',
    city: 'Warszawa',
    phone: '+48600100200',
    email: null,
  },
  parcels: [board],
  declaredValueCents: 100000,
  pickup: 'courier',
  ...over,
})

async function failure(promise: Promise<unknown>): Promise<FurgonetkaError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof FurgonetkaError) return error
    throw error
  }
  throw new Error('expected a FurgonetkaError')
}

const NO_FUNDS = 'Brak środków na koncie Furgonetki – doładuj saldo i spróbuj ponownie'

/** Creates and orders a package, returns its id. */
async function ordered(over: Partial<PackageInput> = {}, commandId = `c-${Math.random()}`) {
  const client = createFakeClient()
  const { packageId } = await client.createPackage(input(over))
  await client.orderPackages(commandId, [packageId])
  return packageId
}

describe('in-process Furgonetka fake', () => {
  beforeEach(() => fakeFurgonetka().reset())

  it('keeps one state for the whole process on globalThis', () => {
    expect(fakeFurgonetka()).toBe(fakeFurgonetka())
    expect((globalThis as Record<string, unknown>).__furgonetkaFake).toBe(fakeFurgonetka())
  })

  it('offers the DPD and InPost services of the Furgonetka agreement', async () => {
    const services = await createFakeClient().services()

    expect(services.map((service) => service.service)).toEqual(['dpd', 'inpostkurier', 'inpost'])
    expect(services.every((service) => service.owner === 'furgonetka')).toBe(true)
    expect(new Set(services.map((service) => service.id)).size).toBe(3)
    expect(await createFakeClient().account()).toEqual({ label: 'Atrapa Furgonetki' })
  })

  it('creates a package that waits, then orders it with a DPD number per parcel', async () => {
    const client = createFakeClient()

    const { packageId } = await client.createPackage(input({ parcels: [board, board] }))
    const waiting = await client.getPackage(packageId)
    expect(waiting).toMatchObject({
      packageId,
      state: 'waiting',
      reference: 'CHNS-1001',
      tracking: [],
      pickupAvailable: false,
    })

    const result = await client.orderPackages('cmd-1', [packageId])

    expect(result).toEqual({ status: 'successful', ordered: [packageId], errors: [] })
    const info = await client.getPackage(packageId)
    expect(info.state).toBe('ordered')
    expect(info.tracking).toHaveLength(2)
    for (const parcel of info.tracking) {
      expect(parcel.number).toMatch(/^0000\d{10}U$/)
      expect(parcel.url).toContain(encodeURIComponent(parcel.number))
    }
    expect(new Set(info.tracking.map((parcel) => parcel.number)).size).toBe(2)
    expect(info.costCents).toBeGreaterThan(0)
    expect(info).toMatchObject({ cancelAvailable: true, pickupAvailable: true })
    expect(fakeFurgonetka().packages).toHaveLength(1)
    expect(fakeFurgonetka().packages[0]).toMatchObject({ reference: 'CHNS-1001', state: 'ordered' })
  })

  it('gives InPost parcels 24-digit numbers', async () => {
    const client = createFakeClient()
    for (const carrier of ['inpost_courier', 'inpost_locker'] as const) {
      const { packageId } = await client.createPackage(input({ carrier }))
      await client.orderPackages(`cmd-${carrier}`, [packageId])

      const info = await client.getPackage(packageId)

      expect(info.tracking[0]?.number).toMatch(/^\d{24}$/)
    }
  })

  it('does nothing the second time for the same command id', async () => {
    const client = createFakeClient()
    const { packageId } = await client.createPackage(input())
    await client.orderPackages('cmd-1', [packageId])
    const numbers = (await client.getPackage(packageId)).tracking

    const again = await client.orderPackages('cmd-1', [packageId])

    expect(again).toEqual({ status: 'successful', ordered: [packageId], errors: [] })
    expect(fakeFurgonetka().commands).toEqual(['cmd-1'])
    expect((await client.getPackage(packageId)).tracking).toEqual(numbers)
  })

  it('orders a whole batch in one command', async () => {
    const client = createFakeClient()
    const first = await client.createPackage(input({ reference: 'CHNS-1' }))
    const second = await client.createPackage(input({ reference: 'CHNS-2' }))

    const result = await client.orderPackages('batch', [first.packageId, second.packageId])

    expect(result.ordered).toEqual([first.packageId, second.packageId])
    expect(fakeFurgonetka().commands).toEqual(['batch'])
  })

  it('refuses to order an unknown or an already ordered package in another command', async () => {
    const client = createFakeClient()
    const id = await ordered()

    const result = await client.orderPackages('other', [id, '999'])

    expect(result.status).toBe('error')
    expect(result.ordered).toEqual([])
    expect(result.errors.map((row) => row.packageId)).toEqual([id, '999'])
  })

  it('orders the package but throws when the answer is lost', async () => {
    const client = createFakeClient()
    const { packageId } = await client.createPackage(input())
    fakeFurgonetka().failNext('lost')

    const error = await failure(client.orderPackages('cmd-1', [packageId]))

    expect(error.kind).toBe('transient')
    const info = await client.getPackage(packageId)
    expect(info.state).toBe('ordered')
    expect(info.tracking[0]?.number).toMatch(/^0000\d{10}U$/)
    expect(fakeFurgonetka().commands).toEqual(['cmd-1'])
    // a retry with the same command id finds it done and does not order again
    const retry = await client.orderPackages('cmd-1', [packageId])
    expect(retry.ordered).toEqual([packageId])
    expect(fakeFurgonetka().commands).toEqual(['cmd-1'])
  })

  it('throws „no funds” once like the real client; the package stays unordered', async () => {
    const client = createFakeClient()
    const { packageId } = await client.createPackage(input())
    fakeFurgonetka().failNext('no_funds')

    const error = await failure(client.orderPackages('cmd-1', [packageId]))

    expect([error.kind, error.message]).toEqual(['no_funds', NO_FUNDS])
    expect((await client.getPackage(packageId)).state).toBe('waiting')
    expect(fakeFurgonetka().commands).toEqual([])
    // the next try goes through
    expect((await client.orderPackages('cmd-2', [packageId])).status).toBe('successful')
  })

  it('runs out of balance before the last package once, like the real client returns it', async () => {
    const client = createFakeClient()
    const ids: string[] = []
    for (const reference of ['CHNS-1', 'CHNS-2', 'CHNS-3']) {
      ids.push((await client.createPackage(input({ reference }))).packageId)
    }
    fakeFurgonetka().failNext('partial_funds')

    const result = await client.orderPackages('cmd-1', ids)

    expect(result).toEqual({
      status: 'partial_success',
      ordered: ids.slice(0, 2),
      errors: [{ packageId: null, message: NO_FUNDS, code: null }],
    })
    expect(await Promise.all(ids.map(async (id) => (await client.getPackage(id)).state))).toEqual([
      'ordered',
      'ordered',
      'waiting',
    ])
    expect(fakeFurgonetka().commands).toEqual(['cmd-1'])
    // the next try orders the last one
    expect((await client.orderPackages('cmd-2', ids.slice(2))).status).toBe('successful')
  })

  it('throws „no funds” for a single package the balance does not cover', async () => {
    const client = createFakeClient()
    const { packageId } = await client.createPackage(input())
    fakeFurgonetka().failNext('partial_funds')

    const error = await failure(client.orderPackages('cmd-1', [packageId]))

    expect([error.kind, error.message]).toEqual(['no_funds', NO_FUNDS])
    expect((await client.getPackage(packageId)).state).toBe('waiting')
    expect(fakeFurgonetka().commands).toEqual([])
  })

  it('fails the next package creation as transient, once', async () => {
    const client = createFakeClient()
    fakeFurgonetka().failNext('transient')

    const error = await failure(client.createPackage(input()))

    expect([error.kind, error.status]).toEqual(['transient', 503])
    expect(fakeFurgonetka().packages).toHaveLength(0)
    expect((await client.createPackage(input())).packageId).toBeTruthy()
  })

  it('refuses the next package creation with a validation message, once', async () => {
    const client = createFakeClient()
    fakeFurgonetka().failNext('validation')

    const error = await failure(client.createPackage(input()))

    expect([error.kind, error.status]).toEqual(['permanent', 400])
    expect(error.message).toBe('/receiver/postcode: Nieprawidłowy kod pocztowy')
    expect(fakeFurgonetka().packages).toHaveLength(0)
    expect((await client.createPackage(input())).packageId).toBeTruthy()
  })

  it('finds a package by its reference and skips cancelled ones', async () => {
    const client = createFakeClient()
    const first = await ordered({ reference: 'CHNS-1001' })
    await client.cancelPackages([first])
    expect(await client.findPackage('CHNS-1001')).toBeNull()

    const { packageId } = await client.createPackage(input({ reference: 'CHNS-1001' }))

    expect((await client.findPackage('CHNS-1001'))?.packageId).toBe(packageId)
    expect(await client.findPackage('CHNS-10010')).toBeNull()
  })

  it('deletes an unordered package, tolerates a missing one, refuses an ordered one', async () => {
    const client = createFakeClient()
    const { packageId } = await client.createPackage(input())

    await client.deletePackage(packageId)
    await client.deletePackage(packageId)
    expect(fakeFurgonetka().packages).toHaveLength(0)
    expect((await failure(client.getPackage(packageId))).kind).toBe('not_found')

    const id = await ordered()
    expect((await failure(client.deletePackage(id))).kind).toBe('permanent')
  })

  it('cancels an ordered package until the carrier picks it up', async () => {
    const client = createFakeClient()
    const open = await ordered({ reference: 'CHNS-1' })
    const taken = await ordered({ reference: 'CHNS-2' })
    markPickedUp(taken)

    const result = await client.cancelPackages([open, taken])

    expect(result).toEqual([
      { packageId: open, ok: true },
      { packageId: taken, ok: false },
    ])
    expect((await client.getPackage(open)).state).toBe('cancelled')
    // A package cancelled already is not cancelled again.
    expect(await client.cancelPackages([open])).toEqual([{ packageId: open, ok: false }])
    expect(await client.getPackage(taken)).toMatchObject({
      state: 'ordered',
      cancelAvailable: false,
      pickupAvailable: false,
    })
  })

  it('refuses to cancel an unordered package and honours failNext(cancel)', async () => {
    const client = createFakeClient()
    const { packageId } = await client.createPackage(input())
    expect(await client.cancelPackages([packageId])).toEqual([{ packageId, ok: false }])

    const id = await ordered()
    fakeFurgonetka().failNext('cancel')
    expect(await client.cancelPackages([id])).toEqual([{ packageId: id, ok: false }])
    expect((await client.getPackage(id)).state).toBe('ordered')
    expect(await client.cancelPackages([id])).toEqual([{ packageId: id, ok: true }])
  })

  it('serves a sample label per parcel number', async () => {
    const client = createFakeClient()
    const first = await ordered({ parcels: [board, board] }, 'c1')
    const second = await ordered({ reference: 'CHNS-2' }, 'c2')
    const numbers = (id: string) =>
      fakeFurgonetka().packages.find((p) => p.id === id)?.numbers ?? []

    const one = await client.label(first)
    const many = await client.labels([first, second])

    expect(one.subarray(0, 5).toString()).toBe('%PDF-')
    expect(pages(one)).toBe(2)
    expect(pages(many)).toBe(3)
    for (const number of [...numbers(first), ...numbers(second)]) {
      expect(many.toString('latin1')).toContain(number)
    }
  })

  it('has no label for a package that is not ordered', async () => {
    const client = createFakeClient()
    const { packageId } = await client.createPackage(input())

    expect((await failure(client.label(packageId))).kind).toBe('transient')
    expect((await failure(client.labels([packageId]))).kind).toBe('permanent')
  })

  describe('pickups', () => {
    const window = { date: '2026-11-04', from: '10:00', to: '15:00' }

    it('orders one pickup per carrier for the batch', async () => {
      const client = createFakeClient()
      const dpd1 = await ordered({ reference: 'CHNS-1' })
      const dpd2 = await ordered({ reference: 'CHNS-2' })
      const inpost = await ordered({ reference: 'CHNS-3', carrier: 'inpost_courier' })

      const result = await client.orderPickup([dpd1, dpd2, inpost], window)

      expect(result.failed).toEqual([])
      expect(result.ordered.map((row) => row.packageId)).toEqual([dpd1, dpd2, inpost])
      expect(result.ordered[0]?.pickupId).toBe(result.ordered[1]?.pickupId)
      expect(result.ordered[2]?.pickupId).not.toBe(result.ordered[0]?.pickupId)
      expect(result.ordered[0]).toMatchObject({ from: '10:00', to: '15:00' })
      expect(fakeFurgonetka().pickups).toHaveLength(2)
      expect(fakeFurgonetka().pickups[0]).toMatchObject({
        packageIds: [dpd1, dpd2],
        date: '2026-11-04',
      })
      expect((await client.getPackage(dpd1)).pickupAvailable).toBe(false)
    })

    it('fails packages that cannot be picked up', async () => {
      const client = createFakeClient()
      const { packageId: waiting } = await client.createPackage(input())
      const taken = await ordered({ reference: 'CHNS-2' })
      markPickedUp(taken)

      const result = await client.orderPickup([waiting, taken, '999'], window)

      expect(result.ordered).toEqual([])
      expect(result.failed.map((row) => row.packageId)).toEqual([waiting, taken, '999'])
      expect(fakeFurgonetka().pickups).toEqual([])
    })

    it('refuses the next pickup order once with failNext(pickup)', async () => {
      const client = createFakeClient()
      const id = await ordered()
      fakeFurgonetka().failNext('pickup')

      const refused = await client.orderPickup([id], window)
      expect(refused.ordered).toEqual([])
      expect(refused.failed).toHaveLength(1)
      expect(refused.failed[0]?.packageId).toBe(id)
      expect(refused.failed[0]?.message).toContain('Atrapa')

      const retry = await client.orderPickup([id], window)
      expect(retry.ordered).toHaveLength(1)
    })
  })

  describe('tracking and webhooks', () => {
    it('adds the events of the simulation to the tracking, in order', async () => {
      const client = createFakeClient()
      const id = await ordered()
      expect(await client.tracking(id)).toEqual([])

      markPickedUp(id)
      markDelivered(id)

      const events = await client.tracking(id)
      expect(events.map((event) => event.state)).toEqual(['collected', 'delivered'])
      expect(events[0]?.label).toBeTruthy()
      expect(Date.parse(events[0]?.at ?? '')).toBeLessThanOrEqual(Date.parse(events[1]?.at ?? ''))
    })

    it('records a return', async () => {
      const client = createFakeClient()
      const id = await ordered()
      markPickedUp(id)

      markReturned(id)

      expect((await client.tracking(id)).map((event) => event.state)).toEqual([
        'collected',
        'returned',
      ])
    })

    it('does not know the tracking of a missing package', async () => {
      expect((await failure(createFakeClient().tracking('999'))).kind).toBe('not_found')
      expect(() => markPickedUp('999')).toThrow()
    })

    it('builds a webhook body with the control sum for the token „atrapa”', async () => {
      const id = await ordered()
      markPickedUp(id)
      const number = fakeFurgonetka().packages[0]?.numbers[0]

      const body = webhookBody(id, 'collected')

      expect(String(body.package_id)).toBe(id)
      expect(body.package_no).toBe(number)
      expect(body.partner_order_id).toBe('CHNS-1001')
      expect(body.tracking.state).toBe('collected')
      expect(body.tracking.datetime).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
      const { tracking } = body
      const expected = createHash('md5')
        .update(
          `${body.package_id}${body.package_no}${body.partner_order_id}${tracking.state}${tracking.description}${tracking.datetime}${tracking.branch}atrapa`,
        )
        .digest('hex')
      expect(body.control).toBe(expected)
    })
  })

  describe('OAuth', () => {
    const config: FurgonetkaConfig = {
      client: 'fake',
      url: null,
      clientId: null,
      clientSecret: null,
      webhookToken: 'atrapa',
      pickupHours: { from: '10:00', to: '15:00' },
      pickupTodayUntil: '12:00',
      adminUrl: null,
    }
    const redirect = 'http://localhost:9101/admin/furgonetka/callback'

    it('sends the operator straight back to the callback with a code', () => {
      const url = new URL(authorizeUrl(config, 'state-1', redirect))

      expect(`${url.origin}${url.pathname}`).toBe(redirect)
      expect(Object.fromEntries(url.searchParams)).toEqual({ code: 'atrapa', state: 'state-1' })
    })

    it('always connects and refreshes without calling the network', async () => {
      const network = (async () => {
        throw new Error('no network expected')
      }) as unknown as typeof globalThis.fetch
      const before = Date.now()

      const tokens = await exchangeCode(config, 'code-1', redirect, network)
      const refreshed = await refreshTokens(config, tokens.refreshToken, network)

      expect(tokens.accessToken).toBeTruthy()
      expect(tokens.refreshToken).toBeTruthy()
      expect(tokens.accessExpiresAt.getTime()).toBeGreaterThanOrEqual(before + 30 * 24 * 3600_000)
      expect(refreshed.accessToken).toBeTruthy()
      expect(refreshed.accessToken).not.toBe(tokens.accessToken)
    })

    it('fails the next refresh once with failNext(refresh)', async () => {
      fakeFurgonetka().failNext('refresh')

      const error = await failure(refreshTokens(config, 'ref-1'))

      expect(error.kind).toBe('auth')
      expect((await refreshTokens(config, 'ref-1')).accessToken).toBeTruthy()
      // a connect is not a refresh
      fakeFurgonetka().failNext('refresh')
      expect((await exchangeCode(config, 'code-1', redirect)).accessToken).toBeTruthy()
    })
  })

  it('clears everything on reset', async () => {
    const id = await ordered()
    markPickedUp(id)
    fakeFurgonetka().failNext('lost')

    fakeFurgonetka().reset()

    const state = fakeFurgonetka()
    expect([state.packages, state.pickups, state.commands]).toEqual([[], [], []])
    const { packageId } = await createFakeClient().createPackage(input())
    await expect(createFakeClient().orderPackages('c', [packageId])).resolves.toMatchObject({
      status: 'successful',
    })
  })
})

/** Number of `/Type /Page` objects (the page tree is written `/Type/Pages`). */
function pages(pdf: Buffer): number {
  return pdf.toString('latin1').split('/Type /Page').length - 1
}

describe('sampleLabels', () => {
  it('is a valid one-page-per-number A6 PDF with the number on the page', () => {
    const pdf = sampleLabels(['a', 'b'])
    const text = pdf.toString('latin1')

    expect(text.startsWith('%PDF-1.4')).toBe(true)
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true)
    expect(pages(pdf)).toBe(2)
    expect(text.match(/\/MediaBox \[0 0 298 420\]/g)).toHaveLength(2)
    expect(text).toContain('(a)')
    expect(text).toContain('(b)')
  })

  it('has a cross-reference table that points at every object', () => {
    const text = sampleLabels(['0000123456789U', '0000123456790U', '0000123456791U']).toString(
      'latin1',
    )
    const start = Number(/startxref\n(\d+)\n%%EOF/.exec(text)?.[1])
    const table = text.slice(start).split('\n')
    expect(table[0]).toBe('xref')
    const count = Number(table[1]?.split(' ')[1])
    const entries = table.slice(3, 2 + count) // skips the free entry 0000000000 65535 f
    expect(entries.length).toBe(count - 1)
    entries.forEach((entry, index) => {
      const offset = Number(entry.slice(0, 10))
      expect(text.slice(offset).startsWith(`${index + 1} 0 obj`)).toBe(true)
    })
    expect(text).toContain(`/Size ${count}`)
  })

  it('escapes the text so a strange number cannot break the file', () => {
    const text = sampleLabels(['a(b)c\\d ł']).toString('latin1')

    expect(text).toContain('(a\\(b\\)c\\\\d ?)')
  })
})

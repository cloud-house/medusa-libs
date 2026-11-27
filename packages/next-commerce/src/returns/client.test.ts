import type { ReturnClaimResponse, ReturnLookupResponse } from '@cloud-house/commerce-rules'
import { describe, expect, it } from 'vitest'
import { SessionExpiredError } from '../account/client'
import { fakeClient, httpError } from '../cart/fake-client'
import { claimAccountReturn, claimGuestReturn, lookupGuestOrder } from './client'

const LOOKUP: ReturnLookupResponse = {
  display_id: 1001,
  returns: {
    eligible: true,
    blocked: null,
    window: {
      source: 'delivered',
      started_at: '2026-10-10T10:00:00Z',
      last_day: '2026-11-09',
      days: 30,
    },
    items: [
      { id: 'item_1', title: 'Leash spiralny', variant: null, thumbnail: null, returnable: 2 },
    ],
    returns: [],
  },
}

const CLAIM: ReturnClaimResponse = {
  display_id: 1001,
  return: {
    id: 'ret_1',
    display_id: 7,
    status: 'requested',
    requested_at: '2026-11-06T10:00:00Z',
    items: [
      { item_id: 'item_1', title: 'Leash spiralny', variant: null, quantity: 1, reason: 'size' },
    ],
  },
}

const ITEMS = [{ id: 'item_1', quantity: 1, reason: 'size' as const }]

describe('lookupGuestOrder', () => {
  it('wysyła POST /store/returns/lookup z numerem i e-mailem, bez cache', async () => {
    const { client, calls } = fakeClient({ 'POST /store/returns/lookup': LOOKUP })
    expect(await lookupGuestOrder(client, { displayId: 1001, email: 'anna@example.com' })).toEqual(
      LOOKUP,
    )
    expect(calls).toHaveLength(1)
    expect(calls[0]?.init?.body).toEqual({ display_id: 1001, email: 'anna@example.com' })
    expect(calls[0]?.init?.cache).toBe('no-store')
    expect(calls[0]?.init?.headers).toBeUndefined()
  })

  it('404 (zły numer albo e-mail) – null', async () => {
    const { client } = fakeClient({
      'POST /store/returns/lookup': () => {
        throw httpError(404, 'Nie znaleziono zamówienia')
      },
    })
    expect(await lookupGuestOrder(client, { displayId: 5, email: 'a@b.pl' })).toBeNull()
  })

  it('inny błąd leci dalej', async () => {
    const { client } = fakeClient({
      'POST /store/returns/lookup': () => {
        throw httpError(500, 'boom')
      },
    })
    await expect(lookupGuestOrder(client, { displayId: 5, email: 'a@b.pl' })).rejects.toThrow(
      'boom',
    )
  })
})

describe('claimGuestReturn', () => {
  it('wysyła zgłoszenie z numerem, e-mailem, pozycjami i uwagą', async () => {
    const { client, calls } = fakeClient({ 'POST /store/returns/claim': CLAIM })
    const result = await claimGuestReturn(client, {
      displayId: 1001,
      email: 'anna@example.com',
      items: ITEMS,
      note: 'Za duża',
    })
    expect(result).toEqual({ ok: true, response: CLAIM })
    expect(calls[0]?.init?.body).toEqual({
      display_id: 1001,
      email: 'anna@example.com',
      items: ITEMS,
      note: 'Za duża',
    })
    expect(calls[0]?.init?.cache).toBe('no-store')
  })

  it('400 i 409 – komunikat z odpowiedzi backendu', async () => {
    for (const status of [400, 409]) {
      const { client } = fakeClient({
        'POST /store/returns/claim': () => {
          throw httpError(status, 'Zgłoszenie jest już zapisywane.')
        },
      })
      expect(
        await claimGuestReturn(client, { displayId: 1, email: 'a@b.pl', items: ITEMS, note: null }),
      ).toEqual({ ok: false, message: 'Zgłoszenie jest już zapisywane.' })
    }
  })

  it('404 – ten sam komunikat co przy wyszukaniu, nie ujawnia, czy numer istnieje', async () => {
    const { client } = fakeClient({
      'POST /store/returns/claim': () => {
        throw httpError(404, 'cokolwiek')
      },
    })
    expect(
      await claimGuestReturn(client, { displayId: 1, email: 'a@b.pl', items: ITEMS, note: null }),
    ).toEqual({
      ok: false,
      message: 'Nie znaleźliśmy zamówienia o tym numerze z tym adresem e-mail.',
    })
  })

  it('inny błąd (500) leci dalej', async () => {
    const { client } = fakeClient({
      'POST /store/returns/claim': () => {
        throw httpError(500, 'boom')
      },
    })
    await expect(
      claimGuestReturn(client, { displayId: 1, email: 'a@b.pl', items: ITEMS, note: null }),
    ).rejects.toThrow('boom')
  })
})

describe('claimAccountReturn', () => {
  it('wysyła token klienta i pozycje na trasę zamówienia', async () => {
    const { client, calls } = fakeClient({
      'POST /store/account/orders/order_1/return': CLAIM,
    })
    const result = await claimAccountReturn(client, 'jwt-1', 'order_1', {
      items: ITEMS,
      note: null,
    })
    expect(result).toEqual({ ok: true, response: CLAIM })
    expect(calls[0]?.init?.headers).toEqual({ authorization: 'Bearer jwt-1' })
    expect(calls[0]?.init?.body).toEqual({ items: ITEMS, note: null })
    expect(calls[0]?.init?.cache).toBe('no-store')
  })

  it('id zamówienia jest kodowane w ścieżce', async () => {
    const { client, calls } = fakeClient({
      'POST /store/account/orders/a%2Fb/return': CLAIM,
    })
    await claimAccountReturn(client, 'jwt-1', 'a/b', { items: ITEMS, note: null })
    expect(calls[0]?.path).toBe('/store/account/orders/a%2Fb/return')
  })

  it('401 – SessionExpiredError', async () => {
    const { client } = fakeClient({
      'POST /store/account/orders/order_1/return': () => {
        throw httpError(401, 'Unauthorized')
      },
    })
    await expect(
      claimAccountReturn(client, 'stary', 'order_1', { items: ITEMS, note: null }),
    ).rejects.toBeInstanceOf(SessionExpiredError)
  })

  it('404 – „Nie znaleziono zamówienia.”, 400 i 409 – komunikat backendu', async () => {
    const notFound = fakeClient({
      'POST /store/account/orders/order_1/return': () => {
        throw httpError(404, 'x')
      },
    })
    expect(
      await claimAccountReturn(notFound.client, 'jwt', 'order_1', { items: ITEMS, note: null }),
    ).toEqual({ ok: false, message: 'Nie znaleziono zamówienia.' })

    for (const status of [400, 409]) {
      const { client } = fakeClient({
        'POST /store/account/orders/order_1/return': () => {
          throw httpError(status, 'Minął termin na zwrot towaru (30 dni od otrzymania paczki)')
        },
      })
      expect(
        await claimAccountReturn(client, 'jwt', 'order_1', { items: ITEMS, note: null }),
      ).toEqual({
        ok: false,
        message: 'Minął termin na zwrot towaru (30 dni od otrzymania paczki)',
      })
    }
  })

  it('inny błąd (500) leci dalej', async () => {
    const { client } = fakeClient({
      'POST /store/account/orders/order_1/return': () => {
        throw httpError(500, 'boom')
      },
    })
    await expect(
      claimAccountReturn(client, 'jwt', 'order_1', { items: ITEMS, note: null }),
    ).rejects.toThrow('boom')
  })
})

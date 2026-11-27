import { describe, expect, it } from 'vitest'
import { SessionExpiredError } from '../account/client'
import { fakeClient, httpError } from '../cart/fake-client'
import {
  accountFavorites,
  addAccountFavorite,
  mergeAccountFavorites,
  removeAccountFavorite,
  visibleProducts,
} from './client'

describe('ulubione w Medusie', () => {
  it('lista konta z tokenem i bez cache', async () => {
    const { client, calls } = fakeClient({
      'GET /store/account/favorites': { product_ids: ['p2', 'p1'] },
    })
    expect(await accountFavorites(client, 'jwt')).toEqual(['p2', 'p1'])
    expect(calls[0]?.init).toMatchObject({
      headers: { authorization: 'Bearer jwt' },
      cache: 'no-store',
    })
  })

  it('dodanie: lista albo powód odmowy (limit, brak produktu)', async () => {
    const ok = fakeClient({ 'POST /store/account/favorites': { product_ids: ['p1'] } })
    expect(await addAccountFavorite(ok.client, 'jwt', 'p1')).toEqual({ ok: true, ids: ['p1'] })
    expect(ok.calls[0]?.init?.body).toEqual({ product_id: 'p1' })

    const limit = fakeClient({
      'POST /store/account/favorites': () => {
        throw httpError(400, 'Masz już 100 ulubionych – usuń któryś, żeby dodać nowy.')
      },
    })
    expect(await addAccountFavorite(limit.client, 'jwt', 'p1')).toEqual({
      ok: false,
      reason: 'limit',
    })
    const missing = fakeClient({
      'POST /store/account/favorites': () => {
        throw httpError(404, 'Nie znaleziono produktu.')
      },
    })
    expect(await addAccountFavorite(missing.client, 'jwt', 'p1')).toEqual({
      ok: false,
      reason: 'missing',
    })
  })

  it('usunięcie koduje id w ścieżce; łączenie wysyła daty ISO', async () => {
    const del = fakeClient({ 'DELETE /store/account/favorites/p%2F1': { product_ids: [] } })
    expect(await removeAccountFavorite(del.client, 'jwt', 'p/1')).toEqual([])

    const merge = fakeClient({
      'POST /store/account/favorites/merge': { product_ids: ['p1'], trimmed: true },
    })
    expect(
      await mergeAccountFavorites(merge.client, 'jwt', [{ id: 'p1', at: Date.UTC(2026, 9, 1) }]),
    ).toEqual({ ids: ['p1'], trimmed: true })
    expect(merge.calls[0]?.init?.body).toEqual({
      items: [{ product_id: 'p1', added_at: '2026-10-01T00:00:00.000Z' }],
    })
  })

  it('401 – sesja wygasła', async () => {
    const { client } = fakeClient({
      'GET /store/account/favorites': () => {
        throw httpError(401, 'Unauthorized')
      },
    })
    await expect(accountFavorites(client, 'jwt')).rejects.toBeInstanceOf(SessionExpiredError)
  })

  it('widoczne produkty gościa bez tokenu; pusta lista bez zapytania', async () => {
    const { client, calls } = fakeClient({
      'POST /store/catalog/visible': { product_ids: ['p1'] },
    })
    expect(await visibleProducts(client, ['p1', 'p2'])).toEqual(['p1'])
    expect(calls[0]?.init?.headers).toBeUndefined()
    expect(await visibleProducts(client, [])).toEqual([])
    expect(calls).toHaveLength(1)
  })

  it('400 inne niż limit – „invalid”, nie komunikat o limicie', async () => {
    const bad = fakeClient({
      'POST /store/account/favorites': () => {
        throw httpError(400, 'Invalid request: product_id too long')
      },
    })
    expect(await addAccountFavorite(bad.client, 'jwt', 'p1')).toEqual({
      ok: false,
      reason: 'invalid',
    })
  })
})

import { describe, expect, it, vi } from 'vitest'
import { SessionExpiredError } from '../account/client'
import { syncFavoritesFlow } from './sync'

const local = [
  { id: 'p1', at: 2 },
  { id: 'p2', at: 1 },
]

function deps(
  token: string | null,
  overrides: Partial<Parameters<typeof syncFavoritesFlow>[0]> = {},
) {
  return {
    token,
    list: vi.fn(async () => ['k1']),
    merge: vi.fn(async () => ({ ids: ['p1', 'k1'], trimmed: false })),
    visible: vi.fn(async (ids: string[]) => ids.filter((id) => id !== 'p2')),
    ...overrides,
  }
}

describe('synchronizacja ulubionych', () => {
  it('gość: lista z przeglądarki bez produktów wycofanych', async () => {
    const d = deps(null)
    expect(await syncFavoritesFlow(d, local)).toEqual({
      signedIn: false,
      ids: ['p1'],
      trimmed: false,
    })
    expect(d.list).not.toHaveBeenCalled()
  })

  it('zalogowany z listą w przeglądarce: łączenie', async () => {
    const d = deps('jwt')
    expect(await syncFavoritesFlow(d, local)).toEqual({
      signedIn: true,
      ids: ['p1', 'k1'],
      trimmed: false,
    })
    expect(d.merge).toHaveBeenCalledWith(local)
  })

  it('zalogowany bez listy lokalnej: lista konta', async () => {
    const d = deps('jwt')
    expect(await syncFavoritesFlow(d, [])).toEqual({ signedIn: true, ids: ['k1'], trimmed: false })
    expect(d.merge).not.toHaveBeenCalled()
  })

  it('wygasła sesja: jak gość', async () => {
    const d = deps('jwt', {
      list: vi.fn(async () => {
        throw new SessionExpiredError()
      }),
    })
    expect(await syncFavoritesFlow(d, [])).toEqual({ signedIn: false, ids: [], trimmed: false })
  })

  it('łączenie ponad limit zgłasza przycięcie', async () => {
    const d = deps('jwt', { merge: vi.fn(async () => ({ ids: ['p1'], trimmed: true })) })
    expect((await syncFavoritesFlow(d, local)).trimmed).toBe(true)
  })

  it('błąd sieci przechodzi dalej – provider zostawia listę lokalną', async () => {
    const d = deps(null, {
      visible: vi.fn(async () => {
        throw new Error('fetch failed')
      }),
    })
    await expect(syncFavoritesFlow(d, local)).rejects.toThrow('fetch failed')
  })
})

describe('synchronizacja – Review Focus 6c', () => {
  it('wygasła sesja przy łączeniu: lista gościa bez wycofanych', async () => {
    const d = deps('jwt', {
      merge: vi.fn(async () => {
        throw new SessionExpiredError()
      }),
    })
    expect(await syncFavoritesFlow(d, local)).toEqual({
      signedIn: false,
      ids: ['p1'],
      trimmed: false,
    })
    expect(d.visible).toHaveBeenCalledWith(['p1', 'p2'])
  })

  it('inny błąd przy łączeniu przechodzi dalej', async () => {
    const d = deps('jwt', {
      merge: vi.fn(async () => {
        throw new Error('boom')
      }),
    })
    await expect(syncFavoritesFlow(d, local)).rejects.toThrow('boom')
  })
})

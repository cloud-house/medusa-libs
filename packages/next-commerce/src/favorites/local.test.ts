import { FAVORITES_LIMIT } from '@cloud-house/commerce-rules'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LOCAL_FAVORITES_KEY,
  parseLocalFavorites,
  readLocalFavorites,
  sanitizeFavorites,
  toggleLocal,
  writeLocalFavorites,
} from './local'

const NOW = Date.UTC(2026, 9, 26, 12)

describe('lista ulubionych gościa w przeglądarce', () => {
  it('zepsute dane dają pustą listę', () => {
    expect(parseLocalFavorites(null, NOW)).toEqual([])
    expect(parseLocalFavorites('nie-json', NOW)).toEqual([])
    expect(parseLocalFavorites('{}', NOW)).toEqual([])
    expect(parseLocalFavorites('[{"id":1}]', NOW)).toEqual([])
  })

  it('obce pola i złe wpisy odpadają, duplikat zostaje raz z nowszą datą, najnowsze pierwsze', () => {
    expect(
      sanitizeFavorites(
        [
          { id: 'a', at: NOW - 3000, x: 1 },
          { id: 'b', at: NOW - 1000 },
          { id: 'a', at: NOW - 2000 },
          { id: '', at: NOW },
          { id: 'c'.repeat(101), at: NOW },
          'smiec',
        ],
        NOW,
      ),
    ).toEqual([
      { id: 'b', at: NOW - 1000 },
      { id: 'a', at: NOW - 2000 },
    ])
  })

  it('data z przyszłości staje się „teraz”, ponad limit – najnowsze', () => {
    expect(sanitizeFavorites([{ id: 'a', at: NOW + 99_999 }], NOW)).toEqual([{ id: 'a', at: NOW }])
    const many = Array.from({ length: 500 }, (_, i) => ({ id: `p${i}`, at: NOW - i }))
    const list = sanitizeFavorites(many, NOW)
    expect(list).toHaveLength(FAVORITES_LIMIT)
    expect(list[0]).toEqual({ id: 'p0', at: NOW })
  })

  it('przełączanie: dodaje na początek, usuwa, przy limicie nic nie zmienia', () => {
    const added = toggleLocal([{ id: 'a', at: NOW - 1 }], 'b', NOW)
    expect(added).toEqual({
      result: 'added',
      list: [
        { id: 'b', at: NOW },
        { id: 'a', at: NOW - 1 },
      ],
    })
    expect(toggleLocal(added.list, 'a', NOW)).toEqual({
      result: 'removed',
      list: [{ id: 'b', at: NOW }],
    })
    const full = Array.from({ length: FAVORITES_LIMIT }, (_, i) => ({ id: `p${i}`, at: NOW - i }))
    expect(toggleLocal(full, 'nowy', NOW)).toEqual({ result: 'limit', list: full })
  })

  it('data spoza zakresu (np. -1e20) przycięta do 0 – łączenie z kontem nie wywraca się', () => {
    expect(sanitizeFavorites([{ id: 'a', at: -1e20 }], NOW)).toEqual([{ id: 'a', at: 0 }])
    expect(
      new Date(sanitizeFavorites([{ id: 'a', at: -1e20 }], NOW)[0]?.at ?? 0).toISOString(),
    ).toBe('1970-01-01T00:00:00.000Z')
  })
})

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  }
}

describe('pamięć przeglądarki – Review Focus 6c', () => {
  it('domyślny klucz to „ulubione”', () => {
    const storage = memoryStorage()
    writeLocalFavorites(storage, [{ id: 'p1', at: 1 }])
    expect(DEFAULT_LOCAL_FAVORITES_KEY).toBe('ulubione')
    expect(storage.getItem('ulubione')).toBe('[{"id":"p1","at":1}]')
    expect(readLocalFavorites(storage, 10)).toEqual([{ id: 'p1', at: 1 }])
  })

  it('własny klucz sklepu nie dotyka domyślnego', () => {
    const storage = memoryStorage()
    storage.setItem('ulubione', '[{"id":"other","at":1}]')
    writeLocalFavorites(storage, [{ id: 'p1', at: 1 }], 'sklep_ulubione')
    expect(storage.getItem('ulubione')).toBe('[{"id":"other","at":1}]')
    expect(readLocalFavorites(storage, 10, 'sklep_ulubione')).toEqual([{ id: 'p1', at: 1 }])
    writeLocalFavorites(storage, [], 'sklep_ulubione')
    expect(storage.getItem('sklep_ulubione')).toBeNull()
    expect(storage.getItem('ulubione')).not.toBeNull()
  })

  it('pamięć rzucająca wyjątkiem: pusta lista przy odczycie, cisza przy zapisie', () => {
    const broken = {
      ...memoryStorage(),
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    } as Storage
    expect(readLocalFavorites(broken, 10)).toEqual([])
    expect(() => writeLocalFavorites(broken, [{ id: 'p1', at: 1 }])).not.toThrow()
  })

  it('120 wpisów → 100 najnowszych; daty ujemne → 0, z przyszłości → teraz', () => {
    const many = Array.from({ length: 120 }, (_, index) => ({ id: `p${index}`, at: index }))
    const result = sanitizeFavorites(many, 1000)
    expect(result).toHaveLength(FAVORITES_LIMIT)
    expect(result[0]).toEqual({ id: 'p119', at: 119 })
    expect(
      sanitizeFavorites(
        [
          { id: 'a', at: -5 },
          { id: 'b', at: 5000 },
        ],
        1000,
      ),
    ).toEqual([
      { id: 'b', at: 1000 },
      { id: 'a', at: 0 },
    ])
  })
})

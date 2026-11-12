import { DEFAULT_FAVORITES_LIMIT as FAVORITES_LIMIT } from '../../options'
import { mergeFavorites } from '../favorites'

const at = (iso: string) => new Date(iso)
const NOW = at('2026-10-26T12:00:00Z')
const entry = (product_id: string, iso: string) => ({ product_id, added_at: at(iso) })

describe('mergeFavorites', () => {
  it('joins both lists, a duplicate keeps the newer date, newest first', () => {
    const { entries, trimmed } = mergeFavorites(
      [entry('a', '2026-10-01T00:00:00Z'), entry('b', '2026-10-02T00:00:00Z')],
      [entry('b', '2026-10-03T00:00:00Z'), entry('c', '2026-10-04T00:00:00Z')],
      NOW,
    )
    expect(entries).toEqual([
      entry('c', '2026-10-04T00:00:00Z'),
      entry('b', '2026-10-03T00:00:00Z'),
      entry('a', '2026-10-01T00:00:00Z'),
    ])
    expect(trimmed).toBe(false)
  })

  it('a product twice in the incoming list counts once', () => {
    const { entries } = mergeFavorites(
      [],
      [entry('a', '2026-10-01T00:00:00Z'), entry('a', '2026-10-05T00:00:00Z')],
      NOW,
    )
    expect(entries).toEqual([entry('a', '2026-10-05T00:00:00Z')])
  })

  it('a date from the future becomes now', () => {
    const { entries } = mergeFavorites([], [entry('a', '2027-01-01T00:00:00Z')], NOW)
    expect(entries).toEqual([{ product_id: 'a', added_at: NOW }])
  })

  it('keeps the newest entries up to the limit', () => {
    const incoming = Array.from({ length: FAVORITES_LIMIT + 1 }, (_, i) =>
      entry(`p${i}`, new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString()),
    )
    const { entries, trimmed } = mergeFavorites([], incoming, NOW)
    expect(entries).toHaveLength(FAVORITES_LIMIT)
    expect(entries[0]?.product_id).toBe(`p${FAVORITES_LIMIT}`)
    expect(entries.some((e) => e.product_id === 'p0')).toBe(false)
    expect(trimmed).toBe(true)
  })

  it('trims to a given limit instead of the default', () => {
    const incoming = [1, 2, 3, 4].map((i) => entry(`p${i}`, `2026-10-0${i}T00:00:00Z`))
    const { entries, trimmed } = mergeFavorites([], incoming, NOW, 3)
    expect(entries.map((e) => e.product_id)).toEqual(['p4', 'p3', 'p2'])
    expect(trimmed).toBe(true)
  })

  it('empty lists give an empty list', () => {
    expect(mergeFavorites([], [], NOW)).toEqual({ entries: [], trimmed: false })
  })
})

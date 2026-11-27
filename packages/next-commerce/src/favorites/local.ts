import { FAVORITES_LIMIT } from '@cloud-house/commerce-rules'

/** Domyślny klucz listy gościa w localStorage (spec 5b §3.4); sklep podaje własny. */
export const DEFAULT_LOCAL_FAVORITES_KEY = 'ulubione'

export interface LocalFavorite {
  id: string
  /** Czas dodania (ms). */
  at: number
}

const MAX_ID = 100

const isEntry = (value: unknown): value is LocalFavorite => {
  if (!value || typeof value !== 'object') return false
  const { id, at } = value as Record<string, unknown>
  return (
    typeof id === 'string' &&
    id.length > 0 &&
    id.length <= MAX_ID &&
    typeof at === 'number' &&
    Number.isFinite(at)
  )
}

/**
 * Lista z przeglądarki albo od klienta (akcja serwera to publiczny endpoint): tylko poprawne
 * wpisy, jeden na produkt (nowsza data), daty przycięte do 0…teraz, najnowsze pierwsze, max limit.
 */
export function sanitizeFavorites(value: unknown, now: number): LocalFavorite[] {
  if (!Array.isArray(value)) return []
  const byId = new Map<string, LocalFavorite>()
  for (const item of value) {
    if (!isEntry(item)) continue
    // Data z przyszłości → teraz, sprzed 1970 (zepsute dane) → 0 – inaczej łączenie z kontem
    // rzucałoby przy `toISOString()` (przegląd 5b, M-4).
    const at = Math.max(0, Math.min(item.at, now))
    const known = byId.get(item.id)
    if (!known || known.at < at) byId.set(item.id, { id: item.id, at })
  }
  return [...byId.values()].sort((a, b) => b.at - a.at).slice(0, FAVORITES_LIMIT)
}

export function parseLocalFavorites(raw: string | null, now: number): LocalFavorite[] {
  if (!raw) return []
  try {
    return sanitizeFavorites(JSON.parse(raw), now)
  } catch {
    return []
  }
}

/** localStorage bywa niedostępny (tryb prywatny, zablokowane dane) – wtedy pusta lista. */
export function readLocalFavorites(
  storage: Storage | null,
  now = Date.now(),
  key = DEFAULT_LOCAL_FAVORITES_KEY,
): LocalFavorite[] {
  try {
    return parseLocalFavorites(storage?.getItem(key) ?? null, now)
  } catch {
    return []
  }
}

export function writeLocalFavorites(
  storage: Storage | null,
  list: LocalFavorite[],
  key = DEFAULT_LOCAL_FAVORITES_KEY,
): void {
  try {
    if (list.length) storage?.setItem(key, JSON.stringify(list))
    else storage?.removeItem(key)
  } catch {
    // Pełna albo zablokowana pamięć – lista żyje do odświeżenia strony.
  }
}

export function toggleLocal(
  list: LocalFavorite[],
  id: string,
  now: number,
): { list: LocalFavorite[]; result: 'added' | 'removed' | 'limit' } {
  if (list.some((entry) => entry.id === id)) {
    return { list: list.filter((entry) => entry.id !== id), result: 'removed' }
  }
  if (list.length >= FAVORITES_LIMIT) return { list, result: 'limit' }
  return { list: [{ id, at: now }, ...list], result: 'added' }
}

/** Wynik synchronizacji ulubionych przy starcie strony i po zmianie sesji (spec 5b §4). */
export interface FavoritesSync {
  signedIn: boolean
  /** Id produktów, najnowsze pierwsze. */
  ids: string[]
  /** Łączenie z kontem odcięło najstarsze ponad limit. */
  trimmed: boolean
}

export type SaveFavoriteResult = { ok: true; ids: string[] } | { ok: false; message: string }

/** Server actions ulubionych – provider dostaje je w props, testy podstawiają atrapy. */
export interface FavoritesActions {
  syncFavorites(local: unknown): Promise<FavoritesSync>
  saveFavorite(productId: unknown, on: boolean): Promise<SaveFavoriteResult>
}

export const FAVORITES_MESSAGES = {
  limit: 'Masz już 100 ulubionych – usuń któryś, żeby dodać nowy.',
  trimmed: 'Na liście zostało 100 najnowszych ulubionych.',
  failed: 'Nie udało się zapisać ulubionych. Spróbuj ponownie.',
  loadFailed: 'Nie udało się wczytać ulubionych. Odśwież stronę.',
} as const

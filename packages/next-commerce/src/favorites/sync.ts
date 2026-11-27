import { SessionExpiredError } from '../account/client'
import type { LocalFavorite } from './local'
import type { FavoritesSync } from './types'

export interface SyncDeps {
  token: string | null
  list(): Promise<string[]>
  merge(items: LocalFavorite[]): Promise<{ ids: string[]; trimmed: boolean }>
  visible(ids: string[]): Promise<string[]>
}

/**
 * Start strony i zmiana sesji (spec 5b §3.4–3.6): zalogowany z listą gościa – łączenie, bez niej –
 * lista konta; gość albo wygasła sesja – lista z przeglądarki bez produktów wycofanych. Błąd sieci
 * przechodzi dalej: provider zostawia wtedy listę lokalną.
 */
export async function syncFavoritesFlow(
  deps: SyncDeps,
  local: LocalFavorite[],
): Promise<FavoritesSync> {
  if (deps.token) {
    try {
      if (local.length) {
        const { ids, trimmed } = await deps.merge(local)
        return { signedIn: true, ids, trimmed }
      }
      return { signedIn: true, ids: await deps.list(), trimmed: false }
    } catch (error) {
      if (!(error instanceof SessionExpiredError)) throw error
    }
  }
  return {
    signedIn: false,
    ids: await deps.visible(local.map((entry) => entry.id)),
    trimmed: false,
  }
}

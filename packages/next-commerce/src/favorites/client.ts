import type { FavoritesResponse, VisibleProductsResponse } from '@cloud-house/commerce-rules'
import { type AccountClient, statusOf, withToken } from '../account/client'
import type { LocalFavorite } from './local'
import { FAVORITES_MESSAGES } from './types'

const PATH = '/store/account/favorites'

export async function accountFavorites(client: AccountClient, token: string): Promise<string[]> {
  return (await withToken<FavoritesResponse>(client, token, PATH)).product_ids
}

export async function addAccountFavorite(
  client: AccountClient,
  token: string,
  productId: string,
): Promise<{ ok: true; ids: string[] } | { ok: false; reason: 'limit' | 'missing' | 'invalid' }> {
  try {
    const { product_ids } = await withToken<FavoritesResponse>(client, token, PATH, {
      method: 'POST',
      body: { product_id: productId },
    })
    return { ok: true, ids: product_ids }
  } catch (error) {
    // Tylko odmowa z limitu to limit – inne 400 (np. walidacja) to zwykły błąd zapisu.
    if (statusOf(error) === 400) {
      const message = error instanceof Error ? error.message : ''
      return { ok: false, reason: message === FAVORITES_MESSAGES.limit ? 'limit' : 'invalid' }
    }
    if (statusOf(error) === 404) return { ok: false, reason: 'missing' }
    throw error
  }
}

export async function removeAccountFavorite(
  client: AccountClient,
  token: string,
  productId: string,
): Promise<string[]> {
  return (
    await withToken<FavoritesResponse>(client, token, `${PATH}/${encodeURIComponent(productId)}`, {
      method: 'DELETE',
    })
  ).product_ids
}

export async function mergeAccountFavorites(
  client: AccountClient,
  token: string,
  items: LocalFavorite[],
): Promise<{ ids: string[]; trimmed: boolean }> {
  const { product_ids, trimmed } = await withToken<FavoritesResponse>(
    client,
    token,
    `${PATH}/merge`,
    {
      method: 'POST',
      body: {
        items: items.map((item) => ({
          product_id: item.id,
          added_at: new Date(item.at).toISOString(),
        })),
      },
    },
  )
  return { ids: product_ids, trimmed: Boolean(trimmed) }
}

/** Lista gościa: które produkty sklep wciąż pokazuje (bez logowania). */
export async function visibleProducts(client: AccountClient, ids: string[]): Promise<string[]> {
  if (!ids.length) return []
  const { product_ids } = await client.fetch<VisibleProductsResponse>('/store/catalog/visible', {
    method: 'POST',
    body: { product_ids: ids },
    cache: 'no-store',
  })
  return product_ids
}

import type { AuthenticatedMedusaRequest } from '@medusajs/framework/http'
import type { FavoritesResponse } from '../../../../lib/types'
import { visibleProductIds } from '../../../../lib/visible-products'
import { FAVORITE_MODULE } from '../../../../modules/favorite'
import type FavoriteModuleService from '../../../../modules/favorite/service'

export const favoritesOf = (req: AuthenticatedMedusaRequest) =>
  req.scope.resolve<FavoriteModuleService>(FAVORITE_MODULE)

export const salesChannelsOf = (req: AuthenticatedMedusaRequest) =>
  req.publishable_key_context?.sales_channel_ids ?? []

/**
 * The account list without products the shop does not show now. Rows are only hidden, not
 * deleted – a product set to draft for a while comes back.
 */
export async function visibleFavorites(
  req: AuthenticatedMedusaRequest,
): Promise<FavoritesResponse> {
  const entries = await favoritesOf(req).listForCustomer(req.auth_context.actor_id)
  return {
    product_ids: await visibleProductIds(
      req.scope,
      entries.map((entry) => entry.product_id),
      salesChannelsOf(req),
    ),
  }
}

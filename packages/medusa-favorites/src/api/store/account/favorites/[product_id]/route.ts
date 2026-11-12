import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import type { FavoritesResponse } from '../../../../../lib/types'
import { favoritesOf, visibleFavorites } from '../helpers'

/** ♥ again – removing a product that is not on the list changes nothing. */
export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse<FavoritesResponse>,
) {
  await favoritesOf(req).removeForCustomer(req.auth_context.actor_id, String(req.params.product_id))
  res.json(await visibleFavorites(req))
}

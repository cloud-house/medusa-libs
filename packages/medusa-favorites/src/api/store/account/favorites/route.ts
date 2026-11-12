import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { FAVORITES_ERROR_CODES } from '../../../../errors'
import { favoritesOptions } from '../../../../lib/plugin-options'
import type { FavoritesResponse } from '../../../../lib/types'
import { visibleProductIds } from '../../../../lib/visible-products'
import { formatLimitMessage } from '../../../../options'
import { favoritesOf, salesChannelsOf, visibleFavorites } from './helpers'
import type { StoreAccountFavoriteType } from './validators'

/** „Ulubione” of the signed-in customer, newest first. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse<FavoritesResponse>) {
  res.json(await visibleFavorites(req))
}

/** ♥ on a product – a product already on the list stays where it is. */
export async function POST(
  req: AuthenticatedMedusaRequest<StoreAccountFavoriteType>,
  res: MedusaResponse<FavoritesResponse | { type: string; code: string; message: string }>,
) {
  const { product_id } = req.validatedBody
  const customerId = req.auth_context.actor_id
  const service = favoritesOf(req)
  const options = favoritesOptions(req.scope)
  // One list read and one visibility check for the product and the whole list.
  const listed = (await service.listForCustomer(customerId)).map((entry) => entry.product_id)
  const visible = new Set(
    await visibleProductIds(req.scope, [product_id, ...listed], salesChannelsOf(req)),
  )
  if (!visible.has(product_id)) {
    res.status(404).json({
      type: 'not_found',
      code: FAVORITES_ERROR_CODES.productNotFound,
      message: options.messages.productNotFound,
    })
    return
  }
  const outcome = await service.addForCustomer(
    customerId,
    product_id,
    new Date(),
    listed.filter((id) => !visible.has(id)),
  )
  if (outcome === 'limit') {
    res.status(400).json({
      type: 'invalid_data',
      code: FAVORITES_ERROR_CODES.limitReached,
      message: formatLimitMessage(options),
    })
    return
  }
  const shown = listed.filter((id) => visible.has(id))
  res.json({ product_ids: outcome === 'added' ? [product_id, ...shown] : shown })
}

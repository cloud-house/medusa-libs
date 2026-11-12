import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import type { FavoritesResponse } from '../../../../../lib/types'
import { visibleProductIds } from '../../../../../lib/visible-products'
import { favoritesOf, salesChannelsOf } from '../helpers'
import type { StoreAccountFavoritesMergeType } from '../validators'

/** The browser's guest list joins the account after sign-in. */
export async function POST(
  req: AuthenticatedMedusaRequest<StoreAccountFavoritesMergeType>,
  res: MedusaResponse<FavoritesResponse>,
) {
  const customerId = req.auth_context.actor_id
  const service = favoritesOf(req)
  const existing = await service.listForCustomer(customerId)
  const incoming = req.validatedBody.items.map((item) => ({
    product_id: item.product_id,
    added_at: new Date(item.added_at),
  }))
  const candidates = [...new Set([...existing, ...incoming].map((entry) => entry.product_id))]
  const visible = new Set(await visibleProductIds(req.scope, candidates, salesChannelsOf(req)))
  res.json(
    await service.mergeForCustomer(
      customerId,
      incoming,
      candidates.filter((id) => !visible.has(id)),
      new Date(),
    ),
  )
}

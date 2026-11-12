import type {
  MedusaNextFunction,
  MedusaResponse,
  MedusaStoreRequest,
} from '@medusajs/framework/http'
import { brandsStoreRoute } from '../../../lib/brands-store-route'
import { brandsOptions } from '../../../lib/plugin-options'

/**
 * `GET /store/brands` (see {@link brandsStoreRoute}). With `storeRoute: false` the route hands
 * the request on, so the response is the one for an unknown path. A route file of the shop at the
 * same path replaces this one (the shop's route files are loaded after the plugin's).
 */
export function GET(req: MedusaStoreRequest, res: MedusaResponse, next: MedusaNextFunction) {
  if (!brandsOptions(req.scope).storeRoute) return next()
  return brandsStoreRoute(req, res)
}

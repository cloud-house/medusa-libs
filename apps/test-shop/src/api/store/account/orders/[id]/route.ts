import { accountsOptions, ownOrder } from '@cloud-house/medusa-accounts'
import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http'

/**
 * A shop's own route under `/store/account` (like ChoNaSupa's orders): it uses `ownOrder` from the
 * plugin and relies on the plugin's `/store/account*` session guard. Test-only.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const order = await ownOrder(req)
  if (!order) {
    res
      .status(404)
      .json({ type: 'not_found', message: accountsOptions(req.scope).messages.orderNotFound })
    return
  }
  res.json({ order })
}

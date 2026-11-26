import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaResponse,
} from '@medusajs/framework/http'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'

/**
 * Medusa serves `GET /store/orders/:id` to anyone with the id. A guest order (with the address)
 * stays private: only its signed-in customer gets past; the shop uses /store/checkout/orders.
 */
export async function guestOrderGuard(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  const actor = req.auth_context
  if (actor?.actor_type === 'customer' && actor.actor_id) {
    const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: 'order',
      fields: ['customer_id'],
      filters: { id: req.params.id as string },
    })
    if (data[0]?.customer_id === actor.actor_id) {
      next()
      return
    }
  }
  res.status(404).json({ type: 'not_found', message: 'Nie znaleziono zamówienia.' })
}

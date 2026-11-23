import type { AuthenticatedMedusaRequest } from '@medusajs/framework/http'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'

/** The order of `:id` when it belongs to the signed-in customer, else `null` (a draft order never does). */
export async function ownOrder(
  req: AuthenticatedMedusaRequest,
): Promise<{ id: string; display_id: number } | null> {
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: 'order',
    fields: ['id', 'display_id', 'customer_id', 'is_draft_order'],
    filters: { id: req.params.id as string },
  })
  // Types from `.medusa/types` (dev) have `display_id` as a string – the database gives a number.
  const [found] = data as unknown as {
    id: string
    display_id: number
    customer_id: string | null
    is_draft_order: boolean
  }[]
  if (!found || found.is_draft_order || found.customer_id !== req.auth_context.actor_id) return null
  return { id: found.id, display_id: Number(found.display_id) }
}

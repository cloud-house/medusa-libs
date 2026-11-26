import type { DeliveryOption } from '@cloud-house/commerce-rules'
import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils'
import { listShippingOptionsForCartWithPricingWorkflow } from '@medusajs/medusa/core-flows'
import { blockedReason, courierBlockedReason, parcelLockerBlockers } from './parcel-blockers'
import { checkoutPlOptions } from './plugin-options'

type CartRow = {
  id: string
  shipping_address?: { country_code?: string | null } | null
  items?:
    | ({ product_id: string | null; product_title: string | null; title: string } | null)[]
    | null
}
type OptionRow = {
  id: string
  name: string
  amount?: number | string | null
  type?: { code?: string | null; description?: string | null } | null
}

/** Cart items as `{ product_id, title }` for `parcelLockerBlockers`. */
export async function cartItems(container: MedusaContainer, cartId: string) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: 'cart',
    fields: [
      'id',
      'shipping_address.country_code',
      'items.product_id',
      'items.product_title',
      'items.title',
    ],
    filters: { id: cartId },
  })
  const cart = data[0] as unknown as CartRow | undefined
  if (!cart) throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Nie znaleziono koszyka.')
  const items = (cart.items ?? []).flatMap((item) =>
    item ? [{ product_id: item.product_id, title: item.product_title ?? item.title }] : [],
  )
  return { cart, items }
}

/**
 * Delivery options of the cart with prices and availability (spec 3b §4.4): bulky items leave
 * only the courier (spec 6d §5.2).
 */
export async function listDeliveryOptions(
  container: MedusaContainer,
  cartId: string,
): Promise<DeliveryOption[]> {
  const options = checkoutPlOptions(container)
  const { deliveryCodes, deliveryOrder } = options
  const inpostCodes = [deliveryCodes.inpostCourier, deliveryCodes.inpostLocker]
  const { cart, items } = await cartItems(container, cartId)
  if (!cart.shipping_address?.country_code) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Uzupełnij kraj dostawy.')
  }
  const [{ result }, blockers] = await Promise.all([
    listShippingOptionsForCartWithPricingWorkflow(container).run({ input: { cart_id: cartId } }),
    parcelLockerBlockers(container, items),
  ])
  /** Why an InPost method is closed for these items; `null` when it is open. */
  const reasonFor = (code: string) => {
    if (!inpostCodes.includes(code)) return null
    return code === deliveryCodes.inpostLocker
      ? blockedReason(blockers, options)
      : courierBlockedReason(blockers, options)
  }
  const rank = (code: string) => {
    const index = deliveryOrder.indexOf(code)
    return index === -1 ? deliveryOrder.length : index
  }
  return (result as unknown as OptionRow[])
    .map((option) => {
      const code = option.type?.code ?? ''
      const reason = reasonFor(code)
      return {
        id: option.id,
        code,
        name: option.name,
        description: option.type?.description ?? null,
        amount: Number(option.amount ?? 0),
        available: reason === null,
        reason,
      }
    })
    .sort((a, b) => rank(a.code) - rank(b.code))
}

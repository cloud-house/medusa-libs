import { isPolishMobile, MOBILE_FOR_LOCKER } from '@cloud-house/commerce-rules'
import { normalizeLockerCode } from '@cloud-house/medusa-furgonetka'
import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils'
import { blockedReason, courierBlockedReason, parcelLockerBlockers } from './parcel-blockers'
import { checkoutPlOptions } from './plugin-options'
import { quantitiesByVariant, stockShortage } from './stock'

type CheckoutCart = {
  id: string
  sales_channel_id: string | null
  shipping_address?: { phone?: string | null } | null
  items?:
    | ({
        variant_id: string | null
        quantity: number
        product_id: string | null
        product_title: string | null
        title: string
      } | null)[]
    | null
  shipping_methods?:
    | ({ shipping_option_id: string | null; data: Record<string, unknown> | null } | null)[]
    | null
}

/** Shipping option id → type code. */
export async function optionCodes(
  container: MedusaContainer,
  ids: string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map()
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: 'shipping_option',
    fields: ['id', 'type.code'],
    filters: { id: ids },
  })
  return new Map(
    (data as unknown as { id: string; type?: { code?: string | null } | null }[]).map((o) => [
      o.id,
      o.type?.code ?? '',
    ]),
  )
}

/** Why a parcel locker method cannot be used for these items; `null` when it can. */
export async function lockerProblem(
  container: MedusaContainer,
  items: { product_id: string | null | undefined; title: string }[],
  data: Record<string, unknown> | null | undefined,
): Promise<string | null> {
  const options = checkoutPlOptions(container)
  const reason = blockedReason(await parcelLockerBlockers(container, items), options)
  if (reason) return `${options.texts.lockerBlocked} ${reason}`
  return normalizeLockerCode(data?.parcel_locker) ? null : options.texts.lockerMissing
}

/** Why the InPost courier cannot be used for these items; `null` when it can. */
export async function inpostCourierProblem(
  container: MedusaContainer,
  items: { product_id: string | null | undefined; title: string }[],
): Promise<string | null> {
  const options = checkoutPlOptions(container)
  const reason = courierBlockedReason(await parcelLockerBlockers(container, items), options)
  return reason ? `${options.texts.courierBlocked} ${reason}` : null
}

/**
 * Last check before the payment is created: a delivery method is chosen, bulky items are not on
 * the InPost courier or a parcel locker, a parcel locker has a mobile number to send the code to,
 * and every item is in stock. `null` – the payment may start.
 */
export async function runCheckoutCheck(
  container: MedusaContainer,
  cartId: string,
  salesChannelId: string | undefined,
): Promise<{ field: 'delivery' | 'items'; message: string } | null> {
  const { deliveryCodes } = checkoutPlOptions(container)
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: 'cart',
    fields: [
      'id',
      'sales_channel_id',
      'shipping_address.phone',
      'items.variant_id',
      'items.quantity',
      'items.product_id',
      'items.product_title',
      'items.title',
      'shipping_methods.shipping_option_id',
      'shipping_methods.data',
    ],
    filters: { id: cartId },
  })
  const cart = data[0] as unknown as CheckoutCart | undefined
  if (!cart) throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Nie znaleziono koszyka.')

  const method = (cart.shipping_methods ?? []).find((m) => m?.shipping_option_id)
  if (!method?.shipping_option_id) return { field: 'delivery', message: 'Wybierz sposób dostawy.' }
  const code = (await optionCodes(container, [method.shipping_option_id])).get(
    method.shipping_option_id,
  )
  const lines = (cart.items ?? []).flatMap((item) => (item ? [item] : []))
  const items = lines.map((item) => ({
    product_id: item.product_id,
    title: item.product_title ?? item.title,
  }))
  if (code === deliveryCodes.inpostCourier) {
    const problem = await inpostCourierProblem(container, items)
    if (problem) return { field: 'delivery', message: problem }
  }
  if (code === deliveryCodes.inpostLocker) {
    const problem = await lockerProblem(container, items, method.data)
    if (problem) return { field: 'delivery', message: problem }
    if (!isPolishMobile(cart.shipping_address?.phone)) {
      return { field: 'delivery', message: MOBILE_FOR_LOCKER }
    }
  }

  const shortage = await stockShortage(container, {
    wanted: quantitiesByVariant(lines),
    already: new Map(),
    channel: cart.sales_channel_id ?? salesChannelId,
  })
  return shortage ? { field: 'items', message: shortage } : null
}

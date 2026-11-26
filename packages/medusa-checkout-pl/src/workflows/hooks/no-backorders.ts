import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils'
import {
  addToCartWorkflow,
  completeCartWorkflow,
  createCartWorkflow,
  updateLineItemInCartWorkflow,
} from '@medusajs/medusa/core-flows'
import { quantitiesByVariant, stockShortage } from '../../lib/stock'

type CartLine = { id: string; variant_id: string | null; quantity: number | string }
type CartRow = {
  id: string
  completed_at: string | Date | null
  sales_channel_id: string | null
  items?: (CartLine | null)[] | null
}

/** The cart as the check needs it – read here, not from the hook input whose fields differ per workflow. */
async function loadCart(container: MedusaContainer, cartId: string): Promise<CartRow | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: 'cart',
    fields: [
      'id',
      'completed_at',
      'sales_channel_id',
      'items.id',
      'items.variant_id',
      'items.quantity',
    ],
    filters: { id: cartId },
  })
  return (data[0] as unknown as CartRow | undefined) ?? null
}

const lines = (cart: CartRow) =>
  (cart.items ?? []).filter((line): line is CartLine => Boolean(line))

async function assertInStock(
  container: MedusaContainer,
  cart: Pick<CartRow, 'sales_channel_id'>,
  wanted: Map<string, number>,
  already: Map<string, number>,
) {
  const message = await stockShortage(container, {
    wanted,
    already,
    channel: cart.sales_channel_id ?? undefined,
  })
  if (message) throw new MedusaError(MedusaError.Types.INVALID_DATA, message)
}

// No pre-orders (spec 4a §6.5): Medusa lets a variant with „Allow backorders” be bought without
// stock; these hooks refuse it on every way into an order – also through the raw Store API.

// A cart created together with its items (`POST /store/carts` with `items`) – not saved yet, so the
// items come from the hook input.
createCartWorkflow.hooks.validate(async ({ cart }, { container }) => {
  const created = cart as {
    sales_channel_id?: string | null
    items?: ({ variant_id?: string | null; quantity: number | string } | null)[] | null
  }
  await assertInStock(
    container,
    { sales_channel_id: created.sales_channel_id ?? null },
    quantitiesByVariant(created.items ?? []),
    new Map(),
  )
})

addToCartWorkflow.hooks.validate(async ({ input, cart }, { container }) => {
  const current = await loadCart(container, cart.id)
  if (!current) return
  await assertInStock(
    container,
    current,
    quantitiesByVariant((input.items ?? []) as { variant_id?: string | null; quantity: number }[]),
    quantitiesByVariant(lines(current)),
  )
})

updateLineItemInCartWorkflow.hooks.validate(async ({ input, cart }, { container }) => {
  const current = await loadCart(container, cart.id)
  const quantity = Number((input as { update?: { quantity?: number } }).update?.quantity ?? 0)
  const itemId = (input as { item_id?: string }).item_id
  const line = current ? lines(current).find((item) => item.id === itemId) : undefined
  if (!current || !line?.variant_id || quantity <= 0) return
  await assertInStock(
    container,
    current,
    new Map([[line.variant_id, quantity]]),
    quantitiesByVariant(lines(current).filter((item) => item.id !== itemId)),
  )
})

completeCartWorkflow.hooks.validate(async ({ cart }, { container }) => {
  const current = await loadCart(container, cart.id)
  // An already completed cart returns its order (idempotent `complete`, spec 3b) – nothing to check.
  if (!current || current.completed_at) return
  await assertInStock(container, current, quantitiesByVariant(lines(current)), new Map())
})

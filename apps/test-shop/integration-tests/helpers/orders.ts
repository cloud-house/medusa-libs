import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import { type Api, sleep } from './customer'

export interface PlaceOrderOptions {
  email: string
  regionId: string
  /** The signed-in customer the cart belonged to (the order then has this `customer_id`); a guest otherwise. */
  customerId?: string
  /** Order metadata, e.g. `{ create_account: 'true' }`. */
  metadata?: Record<string, unknown>
  /** Metadata of the cart that placed the order, e.g. the account flag. */
  cartMetadata?: Record<string, unknown>
  /** The order lines; default one `Test item`. */
  items?: { title: string; quantity: number; unit_price: number; product_id?: string }[]
  /** The shipping option of the order's delivery method (needed to make a fulfillment). */
  shippingOptionId?: string
}

/**
 * An order as the checkout leaves it: a cart linked to the order, then `order.placed`. The checkout
 * itself is not part of the plugin, so the order is created straight in the Order module.
 */
export async function placeOrder(
  container: MedusaContainer,
  {
    email,
    regionId,
    customerId,
    metadata,
    cartMetadata,
    items,
    shippingOptionId,
  }: PlaceOrderOptions,
): Promise<{ orderId: string; cartId: string }> {
  const cart = await container.resolve(Modules.CART).createCarts({
    region_id: regionId,
    currency_code: 'pln',
    email,
    customer_id: customerId,
    metadata: cartMetadata,
  })
  // Completing a cart gives a guest an order of their own customer record (`has_account: false`).
  const customers = container.resolve(Modules.CUSTOMER)
  const owner =
    customerId ??
    (await customers.listCustomers({ email, has_account: false }, { select: ['id'] }))[0]?.id ??
    (await customers.createCustomers({ email, has_account: false })).id
  const order = await container.resolve(Modules.ORDER).createOrders({
    region_id: regionId,
    currency_code: 'pln',
    email,
    customer_id: owner,
    metadata,
    shipping_address: {
      first_name: 'Jan',
      last_name: 'Kowalski',
      address_1: 'ul. Morska 5',
      postal_code: '80-001',
      city: 'Gdańsk',
      country_code: 'pl',
      phone: '+48600100200',
    },
    items: items ?? [{ title: 'Test item', quantity: 1, unit_price: 1000 }],
    shipping_methods: shippingOptionId
      ? [{ name: 'Kurier', amount: 0, shipping_option_id: shippingOptionId }]
      : undefined,
  })
  await container.resolve(ContainerRegistrationKeys.LINK).create({
    [Modules.ORDER]: { order_id: order.id },
    [Modules.CART]: { cart_id: cart.id },
  })
  await container.resolve(Modules.EVENT_BUS).emit({ name: 'order.placed', data: { id: order.id } })
  return { orderId: order.id, cartId: cart.id }
}

/** Order ids of the signed-in customer (`GET /store/orders`). */
export async function customerOrderIds(
  api: Api,
  authHeaders: Record<string, string>,
): Promise<string[]> {
  const { orders } = (await api.get('/store/orders?fields=id', { headers: authHeaders })).data
  return (orders as { id: string }[]).map((order) => order.id).sort()
}

/** The customer of an order once the `order.placed` subscribers settled (`expected` or timeout). */
export async function orderCustomer(
  container: MedusaContainer,
  orderId: string,
  expected?: (customer: { id: string; has_account: boolean } | null) => boolean,
): Promise<{ id: string; has_account: boolean } | null> {
  const read = async () => {
    const [order] = await container
      .resolve(Modules.ORDER)
      .listOrders({ id: orderId }, { select: ['id', 'customer_id'] })
    if (!order?.customer_id) return null
    const [customer] = await container
      .resolve(Modules.CUSTOMER)
      .listCustomers({ id: order.customer_id }, { select: ['id', 'has_account'] })
    return customer ? { id: customer.id, has_account: customer.has_account } : null
  }
  for (let i = 0; i < 50; i++) {
    const customer = await read()
    if (!expected || expected(customer)) return customer
    await sleep(100)
  }
  return read()
}

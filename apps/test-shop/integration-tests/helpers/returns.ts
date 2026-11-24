import { RETURN_OPTION_CODE } from '@cloud-house/commerce-rules'
import { ensureReturnReasons } from '@cloud-house/medusa-returns'
import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import {
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
} from '@medusajs/medusa/core-flows'

/**
 * What the plugin finds in a real shop: a stock location with a shipping set, the return shipping
 * option (type code `zwrot-wlasny`) and the return reasons. The shop's own seed does this.
 */
export async function setupReturnShipping(container: MedusaContainer, regionId: string) {
  const {
    result: [location],
  } = await createStockLocationsWorkflow(container).run({
    input: {
      locations: [
        {
          name: 'Test warehouse',
          address: { address_1: 'ul. Portowa 3', city: 'Gdańsk', country_code: 'PL' },
        },
      ],
    },
  })
  const set = await container.resolve(Modules.FULFILLMENT).createFulfillmentSets({
    name: 'Test shipping',
    type: 'shipping',
    service_zones: [{ name: 'Poland', geo_zones: [{ type: 'country', country_code: 'pl' }] }],
  })
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  await link.create([
    {
      [Modules.STOCK_LOCATION]: { stock_location_id: location.id },
      [Modules.FULFILLMENT]: { fulfillment_set_id: set.id },
    },
    {
      [Modules.STOCK_LOCATION]: { stock_location_id: location.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: 'manual_manual' },
    },
  ])
  const {
    result: [profile],
  } = await createShippingProfilesWorkflow(container).run({
    input: { data: [{ name: 'Returns profile', type: 'default' }] },
  })
  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: 'Zwrot we własnym zakresie',
        price_type: 'flat',
        provider_id: 'manual_manual',
        service_zone_id: set.service_zones[0].id,
        shipping_profile_id: profile.id,
        type: { label: 'Zwrot', description: 'Zwrot na własny koszt', code: RETURN_OPTION_CODE },
        prices: [
          { currency_code: 'pln', amount: 0 },
          { region_id: regionId, amount: 0 },
        ],
      },
    ],
  })
  await ensureReturnReasons(container)
  return { locationId: location.id }
}

/**
 * Marks the whole order as shipped (and delivered `deliveredDaysAgo` days ago): the Order module's
 * own shipment registration plus a fulfillment linked to the order, as the admin's workflows leave it.
 */
export async function shipOrder(
  container: MedusaContainer,
  orderId: string,
  { deliveredDaysAgo = 1 }: { deliveredDaysAgo?: number } = {},
): Promise<void> {
  const orders = container.resolve(Modules.ORDER)
  const [order] = await orders.listOrders({ id: orderId }, { relations: ['items'] })
  const items = (order.items ?? []).map((item) => ({
    id: item.id,
    quantity: Number(item.quantity),
  }))
  await orders.registerFulfillment({
    order_id: orderId,
    reference: 'fulfillment',
    reference_id: `ful_${orderId}`,
    items,
  })
  await orders.registerShipment({
    order_id: orderId,
    reference: 'fulfillment',
    reference_id: `ful_${orderId}`,
    items,
  })
  const delivered = new Date(Date.now() - deliveredDaysAgo * 24 * 60 * 60_000)
  const fulfillment = await container.resolve(Modules.FULFILLMENT).createFulfillment({
    location_id: 'test',
    provider_id: 'manual_manual',
    delivery_address: { address_1: 'ul. Morska 5', city: 'Gdańsk', country_code: 'pl' },
    items: [],
    labels: [],
    order: {} as never,
    shipped_at: delivered,
    delivered_at: delivered,
  } as never)
  await container.resolve(ContainerRegistrationKeys.LINK).create({
    [Modules.ORDER]: { order_id: orderId },
    [Modules.FULFILLMENT]: { fulfillment_id: fulfillment.id },
  })
}

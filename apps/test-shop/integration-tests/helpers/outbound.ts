import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import {
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
} from '@medusajs/medusa/core-flows'

/**
 * What a shop has when it can ship: a stock location with an address and a phone (the sender), a
 * shipping set with a service zone connected to it, and one shipping option of the manual provider
 * (the delivery method of the test orders).
 */
export async function setupOutbound(
  container: MedusaContainer,
  regionId: string,
): Promise<{ shippingOptionId: string }> {
  const {
    result: [location],
  } = await createStockLocationsWorkflow(container).run({
    input: {
      locations: [
        {
          name: 'Warehouse',
          address: {
            address_1: 'ul. Portowa 3',
            postal_code: '80-002',
            city: 'Gdańsk',
            country_code: 'PL',
            phone: '600 100 200',
          },
        },
      ],
    },
  })
  const set = await container.resolve(Modules.FULFILLMENT).createFulfillmentSets({
    name: 'Test shipping',
    type: 'shipping',
    service_zones: [{ name: 'Poland', geo_zones: [{ type: 'country', country_code: 'pl' }] }],
  })
  await container.resolve(ContainerRegistrationKeys.LINK).create([
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
    input: { data: [{ name: 'Outbound profile', type: 'default' }] },
  })
  const {
    result: [option],
  } = await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: 'Kurier',
        price_type: 'flat',
        provider_id: 'manual_manual',
        service_zone_id: set.service_zones[0].id,
        shipping_profile_id: profile.id,
        type: { label: 'Kurier', description: 'Kurier', code: 'kurier-dpd' },
        prices: [
          { currency_code: 'pln', amount: 0 },
          { region_id: regionId, amount: 0 },
        ],
      },
    ],
  })
  return { shippingOptionId: option.id }
}

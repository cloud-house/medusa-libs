import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys, Modules, ProductStatus } from '@medusajs/framework/utils'
import {
  createInventoryLevelsWorkflow,
  createProductsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from '@medusajs/medusa/core-flows'
import type { TestStore } from './admin'

const FREE_FROM = [{ attribute: 'item_total', operator: 'gte' as const, value: 500 }]

export interface CheckoutShop {
  /** Shipping option ids by type code. */
  options: Record<string, string>
  /** Variant ids: `chair` (plain), `sofa` (parcel class `sofa`), `scarce` (2 in stock). */
  variants: Record<'chair' | 'sofa' | 'scarce', string>
  productIds: Record<'chair' | 'sofa' | 'scarce', string>
  stockLocationId: string
}

/**
 * What the checkout routes need: a stock location in the sales channel, the three delivery
 * methods of a Polish shop (DPD, InPost courier, parcel locker; free above 500), a plain product, a
 * product of the parcel class `sofa` and a product with two pieces in stock.
 */
export async function setupCheckoutShop(
  container: MedusaContainer,
  store: TestStore,
): Promise<CheckoutShop> {
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
          },
        },
      ],
    },
  })
  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: { id: location.id, add: [store.salesChannelId] },
  })
  const set = await container.resolve(Modules.FULFILLMENT).createFulfillmentSets({
    name: 'Shop shipping',
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
    input: { data: [{ name: 'Shop profile', type: 'default' }] },
  })

  const definitions = [
    { code: 'kurier-dpd', name: 'Kurier DPD', price: 16.99 },
    { code: 'kurier-inpost', name: 'Kurier InPost', price: 15.99 },
    { code: 'paczkomat-inpost', name: 'Paczkomat InPost', price: 12.99 },
  ]
  const { result: created } = await createShippingOptionsWorkflow(container).run({
    input: definitions.map((definition) => ({
      name: definition.name,
      price_type: 'flat' as const,
      provider_id: 'manual_manual',
      service_zone_id: set.service_zones[0]?.id as string,
      shipping_profile_id: profile.id,
      type: { label: definition.name, description: definition.name, code: definition.code },
      prices: [
        { currency_code: 'pln', amount: definition.price },
        { currency_code: 'pln', amount: 0, rules: FREE_FROM },
        { region_id: store.regionId, amount: definition.price },
        { region_id: store.regionId, amount: 0, rules: FREE_FROM },
      ],
      rules: [
        { attribute: 'enabled_in_store', value: 'true', operator: 'eq' as const },
        { attribute: 'is_return', value: 'false', operator: 'eq' as const },
      ],
    })),
  })
  const options = Object.fromEntries(
    created.map((option, index) => [definitions[index]?.code as string, option.id]),
  )

  const product = async (handle: string, metadata?: Record<string, unknown>, managed = false) => {
    const {
      result: [made],
    } = await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: handle,
            handle,
            status: ProductStatus.PUBLISHED,
            shipping_profile_id: profile.id,
            metadata,
            sales_channels: [{ id: store.salesChannelId }],
            options: [{ title: 'Size', values: ['Standard'] }],
            variants: [
              {
                title: 'Standard',
                sku: `${handle}-standard`,
                manage_inventory: managed,
                options: { Size: 'Standard' },
                prices: [{ currency_code: 'pln', amount: 100 }],
              },
            ],
          },
        ],
      },
    })
    const variant = made?.variants?.[0]
    if (!made || !variant) throw new Error(`product ${handle} was not created`)
    if (managed) {
      // Creating a managed variant also creates and links its inventory item.
      const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: 'product_variant',
        fields: ['inventory_items.inventory_item_id'],
        filters: { id: variant.id },
      })
      const itemId = (
        data[0] as unknown as { inventory_items: { inventory_item_id: string }[] } | undefined
      )?.inventory_items[0]?.inventory_item_id as string
      await createInventoryLevelsWorkflow(container).run({
        input: {
          inventory_levels: [
            { inventory_item_id: itemId, location_id: location.id, stocked_quantity: 2 },
          ],
        },
      })
    }
    return { productId: made.id, variantId: variant.id }
  }
  const chair = await product('chair')
  const sofa = await product('sofa', { parcel_class: 'sofa' })
  const scarce = await product('scarce', undefined, true)
  return {
    options,
    variants: { chair: chair.variantId, sofa: sofa.variantId, scarce: scarce.variantId },
    productIds: { chair: chair.productId, sofa: sofa.productId, scarce: scarce.productId },
    stockLocationId: location.id,
  }
}

import type { ShippingRate } from '@cloud-house/commerce-rules'
import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { checkoutPlOptions } from './plugin-options'

type PriceRule = { attribute: string; operator: string; value: string | number }

export type ShippingOptionRow = {
  id: string
  name: string
  type?: { code?: string | null; description?: string | null } | null
  prices?:
    | ({
        amount: number | string
        currency_code?: string | null
        price_rules?: (PriceRule | null)[] | null
      } | null)[]
    | null
  rules?: ({ attribute: string; value: string } | null)[] | null
}

const ruleValue = (option: ShippingOptionRow, attribute: string) =>
  option.rules?.find((rule) => rule?.attribute === attribute)?.value

type PriceRow = NonNullable<NonNullable<ShippingOptionRow['prices']>[number]>

const rulesOf = (price: PriceRow) =>
  (price.price_rules ?? []).filter((rule): rule is PriceRule => Boolean(rule))

const isThresholdRule = (rule: PriceRule) =>
  rule.attribute === 'item_total' && (rule.operator === 'gte' || rule.operator === 'gt')

/** Most specific first – Medusa picks the matching price with the most rules (region over currency). */
const bySpecificity = (a: PriceRow, b: PriceRow) => rulesOf(b).length - rulesOf(a).length

/**
 * One delivery method for the price table on content pages (spec 4a §5.1), priced the way the cart
 * is: among the shop currency's prices for the shop region (rules `region_id` and `item_total`
 * only), the most specific one. `amount` – the price without a cart-value rule; `free_from` – the
 * threshold of the most specific zero price with an `item_total` rule. Return options and options
 * hidden from the store give `null`.
 */
export function toShippingRate(
  option: ShippingOptionRow,
  shop: { currency: string; regionId: string | null },
): ShippingRate | null {
  if (
    ruleValue(option, 'enabled_in_store') !== 'true' ||
    ruleValue(option, 'is_return') === 'true'
  ) {
    return null
  }
  const applicable = (option.prices ?? []).flatMap((price) =>
    price &&
    price.currency_code === shop.currency &&
    rulesOf(price).every(
      (rule) =>
        isThresholdRule(rule) || (rule.attribute === 'region_id' && rule.value === shop.regionId),
    )
      ? [price]
      : [],
  )
  const base = applicable
    .filter((price) => !rulesOf(price).some(isThresholdRule))
    .sort(bySpecificity)[0]
  if (!base) return null

  const free = applicable
    .filter((price) => Number(price.amount) === 0 && rulesOf(price).some(isThresholdRule))
    .sort(bySpecificity)
  const mostSpecific = free[0] ? rulesOf(free[0]).length : 0
  const thresholds = free
    .filter((price) => rulesOf(price).length === mostSpecific)
    .flatMap((price) =>
      rulesOf(price)
        .filter(isThresholdRule)
        .map((rule) => Number(rule.value)),
    )
  return {
    id: option.id,
    code: option.type?.code ?? '',
    name: option.name,
    description: option.type?.description ?? null,
    amount: Number(base.amount),
    free_from: thresholds.length > 0 ? Math.min(...thresholds) : null,
  }
}

/** Store delivery methods for the shop region, cheapest first. */
export async function listShippingRates(container: MedusaContainer): Promise<ShippingRate[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { currency } = checkoutPlOptions(container)
  const [{ data: regions }, { data }] = await Promise.all([
    query.graph({ entity: 'region', fields: ['id'], filters: { currency_code: currency } }),
    query.graph({
      entity: 'shipping_option',
      fields: [
        'id',
        'name',
        'type.code',
        'type.description',
        'prices.amount',
        'prices.currency_code',
        'prices.price_rules.attribute',
        'prices.price_rules.operator',
        'prices.price_rules.value',
        'rules.attribute',
        'rules.value',
      ],
    }),
  ])
  // One region (Polska) – the shop sells in one currency (option `currency`).
  const regionId = (regions[0] as { id?: string } | undefined)?.id ?? null
  return (data as unknown as ShippingOptionRow[])
    .flatMap((option) => toShippingRate(option, { currency, regionId }) ?? [])
    .sort((a, b) => a.amount - b.amount || a.name.localeCompare(b.name, 'pl'))
}

import type { ShippingRatesResponse } from '@cloud-house/commerce-rules'
import type { MedusaResponse, MedusaStoreRequest } from '@medusajs/framework/http'
import { listShippingRates } from '../../../lib/shipping-rates'

/** Delivery methods with prices for the „Cennik dostawy” block on content pages (spec 4a §5.1). */
export async function GET(req: MedusaStoreRequest, res: MedusaResponse) {
  res.json({ rates: await listShippingRates(req.scope) } satisfies ShippingRatesResponse)
}

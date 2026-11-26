import type { DeliveryOptionsResponse } from '@cloud-house/commerce-rules'
import type { MedusaResponse, MedusaStoreRequest } from '@medusajs/framework/http'
import { listDeliveryOptions } from '../../../../../lib/delivery-options'

/** Checkout delivery options with prices and parcel locker availability (spec 3b §4.4). */
export async function GET(req: MedusaStoreRequest, res: MedusaResponse) {
  const options = await listDeliveryOptions(req.scope, req.params.id as string)
  res.json({ options } satisfies DeliveryOptionsResponse)
}

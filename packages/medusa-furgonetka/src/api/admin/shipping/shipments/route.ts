import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { MedusaError } from '@medusajs/framework/utils'
import { pageBlockers } from '../../../../lib/admin-view'
import { furgonetkaConfig } from '../../../../lib/config'
import { createShipments } from '../../../../lib/create'
import type { AdminCreateShipmentsType } from '../validators'

/**
 * „Utwórz przesyłki”: one shipment per selected order, each with its own outcome (spec 6d §5.4).
 * A problem of the whole page – no setup, no connection, no warehouse address – refuses the batch.
 */
export async function POST(req: MedusaRequest<AdminCreateShipmentsType>, res: MedusaResponse) {
  const [blocker] = await pageBlockers(req.scope, furgonetkaConfig(process.env))
  if (blocker) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, blocker)
  const { order_ids, pickup } = req.validatedBody
  res.json({ results: await createShipments(req.scope, order_ids, pickup) })
}

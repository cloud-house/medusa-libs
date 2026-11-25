import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { pendingShipments } from '../../../../lib/admin-view'
import { furgonetkaConfig } from '../../../../lib/config'

/** The „Do wysyłki” list (spec 6d §5.4). */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json(await pendingShipments(req.scope, furgonetkaConfig(process.env), new Date()))
}

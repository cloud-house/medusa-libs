import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { furgonetkaConfig } from '../../../lib/config'
import { furgonetkaOptions } from '../../../lib/plugin-options'
import { connectBlocker, connectionState } from '../../../lib/tokens'

/** The connection to Furgonetka for the shipping settings (spec 6d §5.11). */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const config = furgonetkaConfig(process.env)
  const { state, account } = await connectionState(req.scope, config)
  const reason = connectBlocker(config)
  const parcelClasses = furgonetkaOptions(req.scope).parcelClasses.map(({ key, label }) => ({
    key,
    label,
  }))
  res.json({ state, account, canConnect: reason === null, reason, parcelClasses })
}

import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { MedusaError } from '@medusajs/framework/utils'
import { furgonetkaConfig } from '../../../../lib/config'
import { connectFake, NOT_CONFIGURED_MESSAGE, startConnect } from '../../../../lib/tokens'

/**
 * Starts the connection. Returns where to send the operator; the fake connects at once and has
 * nowhere to send them (`url: null`).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const config = furgonetkaConfig(process.env)
  if (!config) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, NOT_CONFIGURED_MESSAGE)
  if (config.client === 'fake') {
    await connectFake(req.scope, config, new Date())
    return res.json({ url: null })
  }
  const { url } = await startConnect(req.scope, config, new Date())
  res.json({ url })
}

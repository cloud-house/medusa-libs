import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils'
import { furgonetkaConfig } from '../../../lib/config'
import { prefixedLogger } from '../../../lib/log'
import { handleWebhook, verifyWebhook, webhookPayload } from '../../../lib/webhook'

/** Furgonetka wants the answer within 5 s; what takes longer finishes after it. */
const ANSWER_WITHIN_MS = 4000

/**
 * Furgonetka's status webhook (spec 6d §5.7). Outside `/admin` and `/store`, so Medusa puts no
 * authentication on it – the control sum with `FURGONETKA_WEBHOOK_TOKEN` is the check. Without
 * the setup or the token it is not there (404). A failure to process is only logged: the answer is
 * still OK, the `sync-shipments` job reads the statuses again.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const config = furgonetkaConfig(process.env)
  if (!config?.webhookToken) throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Not found')
  const payload = webhookPayload(req.body)
  if (!payload || !verifyWebhook(payload, config.webhookToken)) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, 'Zła suma kontrolna.')
  }

  const work = handleWebhook(req.scope, config, payload).catch((error: unknown) => {
    prefixedLogger(req.scope).warn(
      `Webhook Furgonetki dla paczki ${String(payload.package_id)} nieprzetworzony – nadrobi to zadanie: ${error instanceof Error ? error.message : String((error as { message?: unknown } | null)?.message ?? error)}`,
    )
  })
  let timer: NodeJS.Timeout | undefined
  await Promise.race([
    work,
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, ANSWER_WITHIN_MS)
    }),
  ])
  clearTimeout(timer)
  res.json({ status: 'OK' })
}

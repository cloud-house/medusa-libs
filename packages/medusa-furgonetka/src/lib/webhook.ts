import { createHash, timingSafeEqual } from 'node:crypto'
import type { MedusaContainer } from '@medusajs/framework/types'
import { FURGONETKA_MODULE } from '../modules/furgonetka'
import type FurgonetkaModuleService from '../modules/furgonetka/service'
import type { FurgonetkaConfig } from './config'
import { clientFor } from './connect'
import { applyTracking, historyEntries, isTracked } from './tracking'

/** The body of Furgonetka's status webhook, the values as they were sent. */
export interface WebhookPayload {
  package_id?: unknown
  package_no?: unknown
  partner_order_id?: unknown
  tracking?: {
    datetime?: unknown
    state?: unknown
    description?: unknown
    branch?: unknown
  } | null
  control?: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** A field as it goes into the sum: `undefined` and `null` are empty. */
const part = (value: unknown) => (value === undefined || value === null ? '' : String(value))

/** The request body as a payload – a JSON object, also one sent as text; `null` for anything else. */
export function webhookPayload(body: unknown): WebhookPayload | null {
  let value = body
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return null
    }
  }
  return isRecord(value) ? (value as WebhookPayload) : null
}

/**
 * `md5(package_id package_no partner_order_id state description datetime branch token)`, joined
 * without separators, lowercase hex (Furgonetka's webhook documentation).
 */
export function webhookControl(payload: WebhookPayload, token: string): string {
  const tracking = isRecord(payload.tracking) ? payload.tracking : {}
  const text = [
    payload.package_id,
    payload.package_no,
    payload.partner_order_id,
    tracking.state,
    tracking.description,
    tracking.datetime,
    tracking.branch,
  ]
    .map(part)
    .join('')
  return createHash('md5')
    .update(text + token)
    .digest('hex')
}

/** Whether the body carries the sum of this token. The sum is no signature – only a check. */
export function verifyWebhook(payload: WebhookPayload, token: string): boolean {
  if (typeof payload.control !== 'string' || !payload.control) return false
  const given = Buffer.from(payload.control.toLowerCase())
  const expected = Buffer.from(webhookControl(payload, token))
  return given.length === expected.length && timingSafeEqual(given, expected)
}

/**
 * A verified webhook is only a signal (spec 6d §10): the statuses are read again from
 * Furgonetka (`GET /packages/{id}/tracking`) and applied to the shipment of the package. A package
 * the shop does not know, or one not ordered yet, is left alone.
 */
export async function handleWebhook(
  container: MedusaContainer,
  config: FurgonetkaConfig,
  payload: WebhookPayload,
  now: Date = new Date(),
): Promise<void> {
  const packageId = part(payload.package_id)
  if (!packageId) return
  const [row] = await container
    .resolve<FurgonetkaModuleService>(FURGONETKA_MODULE)
    .listShipments(
      { package_id: packageId },
      { order: { created_at: 'DESC', id: 'DESC' }, take: 1 },
    )
  if (!row || !isTracked(row.state)) return
  const events = await clientFor(container, config).tracking(packageId)
  await applyTracking(container, row.id, historyEntries(events), now)
}

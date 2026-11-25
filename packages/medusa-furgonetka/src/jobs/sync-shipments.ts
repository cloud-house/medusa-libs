import type { MedusaContainer } from '@medusajs/framework/types'
import { furgonetkaConfig } from '../lib/config'
import { prefixedLogger } from '../lib/log'
import { sweepShipments } from '../lib/tracking'

/**
 * Every 15 minutes: the statuses of shipments not delivered yet (up to 30 days) and what an
 * interrupted creation left behind – the safety net behind the webhook (spec 6d §5.7).
 * Integration tests call `sweepShipments` with their own clock.
 */
export default async function syncShipmentsJob(container: MedusaContainer) {
  if (process.env.NODE_ENV === 'test' || !furgonetkaConfig(process.env)) return
  try {
    await sweepShipments(container, new Date())
  } catch (error) {
    prefixedLogger(container).warn(
      `Przegląd przesyłek nie wyszedł: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

export const config = { name: 'sync-shipments', schedule: '*/15 * * * *' }

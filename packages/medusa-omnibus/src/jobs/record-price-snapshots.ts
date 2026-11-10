import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { formatLog } from '../messages'
import { PRICE_HISTORY_MODULE } from '../modules/price-history'
import type PriceHistoryModuleService from '../modules/price-history/service'
import { recordPriceSnapshotsWorkflow } from '../workflows/price-history/record-price-snapshots'

/** Hourly price history for the Omnibus "lowest price in 30 days before the reduction". */
export default async function recordPriceSnapshotsJob(container: MedusaContainer) {
  const { result } = await recordPriceSnapshotsWorkflow(container).run({ input: {} })
  if (result.recorded > 0) {
    const { messages, logPrefix } = container
      .resolve<PriceHistoryModuleService>(PRICE_HISTORY_MODULE)
      .getOptions()
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .info(formatLog(logPrefix, messages.recorded(result.recorded)))
  }
}

// Static: Medusa reads a job's schedule when it loads the file, so it cannot be an option.
export const config = { name: 'record-price-snapshots', schedule: '0 * * * *' }

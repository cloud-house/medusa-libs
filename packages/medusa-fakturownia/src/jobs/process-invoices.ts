import type { MedusaContainer } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { sweepCorrections } from '../lib/correction'
import { invoicingConfig, logPrefix } from '../lib/plugin-options'
import { sweepInvoices } from '../lib/process'

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

/**
 * Every 15 minutes: invoices still waiting, retries, KSeF numbers and e-mails (spec 6c §5.6) –
 * also what a lost event left behind; then the credit notes of received returns (spec 6e-b, D3),
 * after the invoices so a note waiting for its invoice can go in the same pass. Integration tests
 * call `sweepInvoices` and `sweepCorrections` with their own clock.
 */
export default async function processInvoicesJob(container: MedusaContainer) {
  if (process.env.NODE_ENV === 'test' || !invoicingConfig(container)) return
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    await sweepInvoices(container)
  } catch (error) {
    logger.warn(`${logPrefix(container)} Przegląd faktur nie wyszedł: ${errorText(error)}`)
  }
  try {
    await sweepCorrections(container)
  } catch (error) {
    logger.warn(`${logPrefix(container)} Przegląd korekt nie wyszedł: ${errorText(error)}`)
  }
}

export const config = { name: 'process-invoices', schedule: '*/15 * * * *' }

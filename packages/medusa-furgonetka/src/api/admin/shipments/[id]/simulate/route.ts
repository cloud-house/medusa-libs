import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { MedusaError } from '@medusajs/framework/utils'
import { furgonetkaConfig } from '../../../../../lib/config'
import { ShipmentActionError } from '../../../../../lib/create'
import { markDelivered, markPickedUp, webhookBody } from '../../../../../lib/fake'
import { isTracked } from '../../../../../lib/tracking'
import { handleWebhook } from '../../../../../lib/webhook'
import { FURGONETKA_MODULE } from '../../../../../modules/furgonetka'
import type FurgonetkaModuleService from '../../../../../modules/furgonetka/service'

/** The panel's events and the tracking state the fake records for each. */
const EVENTS = {
  picked_up: { state: 'collected', mark: markPickedUp },
  delivered: { state: 'delivered', mark: markDelivered },
} as const

const NOT_TRACKED_MESSAGE = 'Ta przesyłka nie ma jeszcze zamówionej paczki w Furgonetce.'

/**
 * „Symuluj odbiór” / „Symuluj doręczenie” (spec 6d §5.12): only with the fake and outside
 * production, else not there (404). The fake records the scan, then its webhook goes through the
 * same handling as one from Furgonetka.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const config = furgonetkaConfig(process.env)
  if (config?.client !== 'fake' || process.env.NODE_ENV === 'production') {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Not found')
  }
  const name = (req.body as { event?: unknown } | undefined)?.event
  if (name !== 'picked_up' && name !== 'delivered') {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'Nieznane zdarzenie – oczekiwane „picked_up” albo „delivered”.',
    )
  }
  const shipments = req.scope.resolve<FurgonetkaModuleService>(FURGONETKA_MODULE)
  const [row] = await shipments.listShipments({ id: req.params.id as string })
  if (!row) throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Nie ma takiej przesyłki.')
  if (!row.package_id || !isTracked(row.state)) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, NOT_TRACKED_MESSAGE)
  }

  const event = EVENTS[name]
  try {
    event.mark(row.package_id)
    await handleWebhook(req.scope, config, webhookBody(row.package_id, event.state))
  } catch (error) {
    if (error instanceof ShipmentActionError) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, error.message)
    }
    throw error
  }
  res.json({ shipment: await shipments.retrieveShipment(row.id) })
}

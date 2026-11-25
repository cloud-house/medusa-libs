import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { MedusaError } from '@medusajs/framework/utils'
import { LABEL_STATES } from '../../../../../lib/admin-view'
import { NO_SHIPMENT_MESSAGE } from '../../../../../lib/create'
import { orderFacts } from '../../../../../lib/tracking'
import { FURGONETKA_MODULE } from '../../../../../modules/furgonetka'
import type FurgonetkaModuleService from '../../../../../modules/furgonetka/service'
import { sendLabel } from '../../../shipping/helpers'

const NO_LABEL_MESSAGE = 'Ta przesyłka nie ma jeszcze etykiety.'

/**
 * „Drukuj etykietę”: the A6 label of one shipment (spec 6d §5.5), the `label_url` of its
 * fulfillment. Only a shipment whose package is ordered has one.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const shipments = req.scope.resolve<FurgonetkaModuleService>(FURGONETKA_MODULE)
  const [row] = await shipments.listShipments({ id: req.params.id as string }, { take: 1 })
  if (!row) throw new MedusaError(MedusaError.Types.NOT_FOUND, NO_SHIPMENT_MESSAGE)
  const packageId = row.package_id
  if (!packageId || !LABEL_STATES.includes(row.state)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, NO_LABEL_MESSAGE)
  }

  const { displayId } = await orderFacts(req.scope, row.order_id)
  await sendLabel(req, res, `etykieta-${displayId ?? row.id}.pdf`, (client) =>
    client.label(packageId),
  )
}

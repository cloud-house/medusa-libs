import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { MedusaError } from '@medusajs/framework/utils'
import { LABEL_STATES } from '../../../../lib/admin-view'
import { FURGONETKA_MODULE } from '../../../../modules/furgonetka'
import type FurgonetkaModuleService from '../../../../modules/furgonetka/service'
import { sendLabel } from '../helpers'

const NO_LABELS_MESSAGE = 'Brak etykiet dla zaznaczonych przesyłek'
const TOO_MANY_MESSAGE = 'Zaznacz najwyżej 50 przesyłek.'
const MAX_IDS = 50

/** The ids of `?ids=shp_1,shp_2`, without blanks and repeats. */
function idsOf(value: unknown): string[] {
  if (typeof value !== 'string') return []
  return [
    ...new Set(
      value
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ]
}

/** The day in Warsaw as `RRRR-MM-DD`, for the name of the file. */
const warsawDay = (now: Date) => now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' })

/**
 * „Drukuj etykiety”: one PDF with the A6 labels of the selected shipments (spec 6d §5.4). Every
 * selected shipment must have a label – a draft, a failed one or an unknown id refuses the lot.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const ids = idsOf(req.query.ids)
  if (ids.length > MAX_IDS) throw new MedusaError(MedusaError.Types.INVALID_DATA, TOO_MANY_MESSAGE)
  const shipments = req.scope.resolve<FurgonetkaModuleService>(FURGONETKA_MODULE)
  const rows = ids.length ? await shipments.listShipments({ id: ids }, { take: null }) : []
  const packageIds = ids.map((id) => {
    const row = rows.find((candidate) => candidate.id === id)
    return row && LABEL_STATES.includes(row.state) ? row.package_id : null
  })
  if (!ids.length || packageIds.some((packageId) => !packageId)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, NO_LABELS_MESSAGE)
  }

  await sendLabel(req, res, `etykiety-${warsawDay(new Date())}.pdf`, (client) =>
    client.labels(packageIds as string[]),
  )
}

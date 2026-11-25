import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { MedusaError } from '@medusajs/framework/utils'
import { loadAdminShipment } from '../../../lib/admin-view'
import { FurgonetkaError } from '../../../lib/api-errors'
import type { AdminShipmentResponse } from '../../../lib/card-types'
import type { FurgonetkaClient } from '../../../lib/client'
import { furgonetkaConfig } from '../../../lib/config'
import { clientFor } from '../../../lib/connect'
import { ShipmentActionError } from '../../../lib/create'
import { NOT_CONFIGURED_MESSAGE } from '../../../lib/tokens'

/** A shipment request the shop refuses becomes HTTP 400 with the Polish reason for the panel. */
export async function refusing<T>(job: () => Promise<T>): Promise<T> {
  try {
    return await job()
  } catch (error) {
    if (error instanceof ShipmentActionError) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, error.message)
    }
    throw error
  }
}

/** The „Wysyłka” card of an order as it is now – what the card routes answer with. */
export function loadCard(req: MedusaRequest, orderId: string): Promise<AdminShipmentResponse> {
  return loadAdminShipment(req.scope, furgonetkaConfig(process.env), orderId, new Date())
}

/**
 * Answers with a label PDF that `fetchPdf` gets from Furgonetka. Furgonetka (or the network)
 * being down is 503 – worth another try; anything else Furgonetka says is for the operator.
 */
export async function sendLabel(
  req: MedusaRequest,
  res: MedusaResponse,
  filename: string,
  fetchPdf: (client: FurgonetkaClient) => Promise<Buffer>,
): Promise<void> {
  const config = furgonetkaConfig(process.env)
  if (!config) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, NOT_CONFIGURED_MESSAGE)
  let pdf: Buffer
  try {
    pdf = await fetchPdf(clientFor(req.scope, config))
  } catch (error) {
    if (!(error instanceof FurgonetkaError)) throw error
    if (error.kind === 'transient') {
      res.status(503).json({ type: 'unavailable', message: error.message })
      return
    }
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, error.message)
  }
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`)
  res.setHeader('Cache-Control', 'private, no-store')
  res.send(pdf)
}

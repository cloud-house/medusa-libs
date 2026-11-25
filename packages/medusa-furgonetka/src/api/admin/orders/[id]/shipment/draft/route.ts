import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { clearDraft, saveDraft } from '../../../../../../lib/drafts'
import { loadCard, refusing } from '../../../../shipping/helpers'
import type { AdminShipmentDraftType } from '../../../../shipping/validators'

/** „Zapisz”: the plan of the card becomes the draft of the order's shipment (spec 6d §5.5). */
export async function POST(req: MedusaRequest<AdminShipmentDraftType>, res: MedusaResponse) {
  const orderId = req.params.id as string
  await refusing(() => saveDraft(req.scope, orderId, req.validatedBody))
  res.json(await loadCard(req, orderId))
}

/** „Przywróć podpowiedź”: the draft goes, the suggestion is back. */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const orderId = req.params.id as string
  await refusing(() => clearDraft(req.scope, orderId))
  res.json(await loadCard(req, orderId))
}

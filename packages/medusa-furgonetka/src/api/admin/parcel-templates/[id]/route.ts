import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { FURGONETKA_MODULE } from '../../../../modules/furgonetka'
import type FurgonetkaModuleService from '../../../../modules/furgonetka/service'
import { checkPurpose } from '../purpose'
import type { AdminSaveParcelTemplateType } from '../validators'

export async function POST(req: MedusaRequest<AdminSaveParcelTemplateType>, res: MedusaResponse) {
  checkPurpose(req.scope, req.validatedBody.purpose)
  const furgonetka: FurgonetkaModuleService = req.scope.resolve(FURGONETKA_MODULE)
  const template = await furgonetka.saveTemplate({
    ...req.validatedBody,
    id: req.params.id as string,
  })
  res.json({ template })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const furgonetka: FurgonetkaModuleService = req.scope.resolve(FURGONETKA_MODULE)
  const id = req.params.id as string
  await furgonetka.removeTemplate(id)
  res.json({ id, object: 'parcel_template', deleted: true })
}

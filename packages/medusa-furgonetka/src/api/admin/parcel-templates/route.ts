import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { FURGONETKA_MODULE } from '../../../modules/furgonetka'
import type FurgonetkaModuleService from '../../../modules/furgonetka/service'
import { checkPurpose } from './purpose'
import type { AdminSaveParcelTemplateType } from './validators'

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const furgonetka: FurgonetkaModuleService = req.scope.resolve(FURGONETKA_MODULE)
  const rows = await furgonetka.listParcelTemplates({}, { take: null })
  const templates = [...rows].sort((a, b) => a.name.localeCompare(b.name, 'pl'))
  res.json({ templates })
}

export async function POST(req: MedusaRequest<AdminSaveParcelTemplateType>, res: MedusaResponse) {
  checkPurpose(req.scope, req.validatedBody.purpose)
  const furgonetka: FurgonetkaModuleService = req.scope.resolve(FURGONETKA_MODULE)
  const template = await furgonetka.saveTemplate(req.validatedBody)
  res.json({ template })
}

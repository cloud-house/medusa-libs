import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { BRAND_MODULE } from '../../../../modules/brand'
import type BrandModuleService from '../../../../modules/brand/service'
import { deleteBrandWorkflow, updateBrandWorkflow } from '../../../../workflows'
import { orHandleTaken } from '../../../handle-taken'
import type { AdminUpdateBrandType } from '../validators'

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const brands: BrandModuleService = req.scope.resolve(BRAND_MODULE)
  const brand = await brands.retrieveBrand(req.params.id as string)
  res.json({ brand })
}

export async function POST(req: MedusaRequest<AdminUpdateBrandType>, res: MedusaResponse) {
  const run = await orHandleTaken(res, () =>
    updateBrandWorkflow(req.scope).run({
      input: { id: req.params.id as string, ...req.validatedBody },
    }),
  )
  if (run) res.json({ brand: run.result })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const { result } = await deleteBrandWorkflow(req.scope).run({
    input: { id: req.params.id as string },
  })
  res.json({ id: result.id, object: 'brand', deleted: true })
}

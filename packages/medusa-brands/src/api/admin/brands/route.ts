import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { brandsOptions } from '../../../lib/plugin-options'
import { createBrandWorkflow } from '../../../workflows'
import { orHandleTaken } from '../../handle-taken'
import type { AdminCreateBrandType } from './validators'

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { sortLocale } = brandsOptions(req.scope).messages
  const { data } = await query.graph({
    entity: 'brand',
    fields: ['id', 'name', 'handle', 'products.id'],
  })
  const brands = data
    .map((brand) => ({
      id: brand.id,
      name: brand.name,
      handle: brand.handle,
      product_count: (brand.products ?? []).filter(Boolean).length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, sortLocale))

  res.json({ brands, count: brands.length })
}

export async function POST(req: MedusaRequest<AdminCreateBrandType>, res: MedusaResponse) {
  const run = await orHandleTaken(res, () =>
    createBrandWorkflow(req.scope).run({ input: req.validatedBody }),
  )
  if (run) res.json({ brand: run.result })
}

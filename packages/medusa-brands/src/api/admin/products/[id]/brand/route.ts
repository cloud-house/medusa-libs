import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils'
import { BRAND_ERROR_CODES } from '../../../../../errors'
import { fill } from '../../../../../lib/fill'
import { brandsOptions } from '../../../../../lib/plugin-options'
import { setProductBrandWorkflow } from '../../../../../workflows'
import type { AdminSetProductBrandType } from './validators'

async function productBrand(req: MedusaRequest) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: 'product',
    fields: ['id', 'brand.id', 'brand.name', 'brand.handle'],
    filters: { id: req.params.id as string },
  })
  const [product] = data
  if (!product) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      fill(brandsOptions(req.scope).messages.productNotFound, { id: req.params.id as string }),
      BRAND_ERROR_CODES.productNotFound,
    )
  }
  const brand = product.brand
  return brand ? { id: brand.id, name: brand.name, handle: brand.handle } : null
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json({ brand: await productBrand(req) })
}

export async function POST(req: MedusaRequest<AdminSetProductBrandType>, res: MedusaResponse) {
  await setProductBrandWorkflow(req.scope).run({
    input: { product_id: req.params.id as string, brand_id: req.validatedBody.brand_id },
  })
  res.json({ brand: await productBrand(req) })
}

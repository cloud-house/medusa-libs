import { defineMiddlewares, validateAndTransformBody } from '@medusajs/framework/http'
import { adminCreateBrandFor, adminUpdateBrandFor } from './admin/brands/validators'
import { AdminSetProductBrand } from './admin/products/[id]/brand/validators'
import { brandFieldCode, validateBody } from './validate'

export default defineMiddlewares({
  routes: [
    {
      matcher: '/admin/brands',
      method: 'POST',
      middlewares: [validateBody(adminCreateBrandFor, brandFieldCode)],
    },
    {
      matcher: '/admin/brands/:id',
      method: 'POST',
      middlewares: [validateBody(adminUpdateBrandFor, brandFieldCode)],
    },
    {
      matcher: '/admin/products/:id/brand',
      method: 'POST',
      middlewares: [validateAndTransformBody(AdminSetProductBrand)],
    },
  ],
})

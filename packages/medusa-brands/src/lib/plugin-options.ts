import type { MedusaContainer } from '@medusajs/framework/types'
import { BRAND_MODULE } from '../modules/brand'
import type BrandModuleService from '../modules/brand/service'
import type { ResolvedBrandsOptions } from '../options'

/** The plugin options as the brand module got them from `medusa-config.ts`. */
export const brandsOptions = (scope: MedusaContainer): ResolvedBrandsOptions =>
  scope.resolve<BrandModuleService>(BRAND_MODULE).getOptions()

import type { MedusaContainer } from '@medusajs/framework/types'
import { FAVORITE_MODULE } from '../modules/favorite'
import type FavoriteModuleService from '../modules/favorite/service'
import type { ResolvedFavoritesOptions } from '../options'

/** The plugin options as the favorite module got them from `medusa-config.ts`. */
export const favoritesOptions = (scope: MedusaContainer): ResolvedFavoritesOptions =>
  scope.resolve<FavoriteModuleService>(FAVORITE_MODULE).getOptions()

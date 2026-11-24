import type { MedusaContainer } from '@medusajs/framework/types'
import { RETURNS_MODULE } from '../modules/shop-returns'
import type ShopReturnsModuleService from '../modules/shop-returns/service'
import type { ResolvedReturnsOptions } from '../options'

/** The plugin options as the `shopReturns` module got them from `medusa-config.ts`. */
export function returnsOptions(scope: Pick<MedusaContainer, 'resolve'>): ResolvedReturnsOptions {
  let service: ShopReturnsModuleService
  try {
    service = scope.resolve<ShopReturnsModuleService>(RETURNS_MODULE)
  } catch {
    throw new Error(
      `medusa-returns: the \`${RETURNS_MODULE}\` module is not registered – add the plugin to \`plugins\` in medusa-config (do not list the module in \`modules\` yourself).`,
    )
  }
  return service.getOptions()
}

/** The prefix of the log lines (`logPrefix` option). */
export const logPrefix = (scope: Pick<MedusaContainer, 'resolve'>): string =>
  returnsOptions(scope).logPrefix

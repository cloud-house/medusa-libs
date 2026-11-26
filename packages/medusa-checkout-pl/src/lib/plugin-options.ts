import type { MedusaContainer } from '@medusajs/framework/types'
import { CHECKOUT_PL_MODULE } from '../modules/checkout-pl'
import type CheckoutPlModuleService from '../modules/checkout-pl/service'
import type { ResolvedCheckoutPlOptions } from '../options'

/** The plugin options as the `checkoutPl` module got them from `medusa-config.ts`. */
export function checkoutPlOptions(
  scope: Pick<MedusaContainer, 'resolve'>,
): ResolvedCheckoutPlOptions {
  let service: CheckoutPlModuleService
  try {
    service = scope.resolve<CheckoutPlModuleService>(CHECKOUT_PL_MODULE)
  } catch {
    throw new Error(
      `medusa-checkout-pl: the \`${CHECKOUT_PL_MODULE}\` module is not registered – add the plugin to \`plugins\` in medusa-config (do not list the module in \`modules\` yourself).`,
    )
  }
  return service.getOptions()
}

/** The prefix of the log lines (`logPrefix` option). */
export const logPrefix = (scope: Pick<MedusaContainer, 'resolve'>): string =>
  checkoutPlOptions(scope).logPrefix

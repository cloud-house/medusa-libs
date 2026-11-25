import type { MedusaContainer } from '@medusajs/framework/types'
import { FURGONETKA_MODULE } from '../modules/furgonetka'
import type FurgonetkaModuleService from '../modules/furgonetka/service'
import type { ResolvedFurgonetkaOptions } from '../options'

/** The plugin options as the `furgonetka` module got them from `medusa-config.ts`. */
export function furgonetkaOptions(
  scope: Pick<MedusaContainer, 'resolve'>,
): ResolvedFurgonetkaOptions {
  let service: FurgonetkaModuleService
  try {
    service = scope.resolve<FurgonetkaModuleService>(FURGONETKA_MODULE)
  } catch {
    throw new Error(
      `medusa-furgonetka: the \`${FURGONETKA_MODULE}\` module is not registered – add the plugin to \`plugins\` in medusa-config (do not list the module in \`modules\` yourself).`,
    )
  }
  return service.getOptions()
}

/** The prefix of the log lines (`logPrefix` option). */
export const logPrefix = (scope: Pick<MedusaContainer, 'resolve'>): string =>
  furgonetkaOptions(scope).logPrefix

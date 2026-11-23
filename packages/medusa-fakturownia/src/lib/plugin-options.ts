import type { MedusaContainer } from '@medusajs/framework/types'
import { FAKTUROWNIA_MODULE } from '../modules/fakturownia'
import type FakturowniaModuleService from '../modules/fakturownia/service'
import type { ResolvedFakturowniaOptions } from '../options'

/** The plugin options as the `fakturownia` module got them from `medusa-config.ts`. */
export function pluginOptions(scope: Pick<MedusaContainer, 'resolve'>): ResolvedFakturowniaOptions {
  let service: FakturowniaModuleService
  try {
    service = scope.resolve<FakturowniaModuleService>(FAKTUROWNIA_MODULE)
  } catch {
    throw new Error(
      'medusa-fakturownia: the `fakturownia` module is not registered – add the plugin to `plugins` in medusa-config (do not list the module in `modules` yourself).',
    )
  }
  return service.getOptions()
}

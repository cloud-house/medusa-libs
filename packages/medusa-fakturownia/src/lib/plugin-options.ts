import type { MedusaContainer } from '@medusajs/framework/types'
import { FAKTUROWNIA_MODULE } from '../modules/fakturownia'
import type FakturowniaModuleService from '../modules/fakturownia/service'
import type { ResolvedFakturowniaOptions } from '../options'
import { fakturowniaConfig } from './config'

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

/** The prefix of the log lines (`logPrefix` option). */
export const logPrefix = (scope: Pick<MedusaContainer, 'resolve'>): string =>
  pluginOptions(scope).logPrefix

/** Invoicing setup from the env (`null` when the shop issues no invoices) with the shop's `oidPrefix` as the default. */
export const invoicingConfig = (scope: Pick<MedusaContainer, 'resolve'>) =>
  fakturowniaConfig(process.env, pluginOptions(scope).oidPrefix)

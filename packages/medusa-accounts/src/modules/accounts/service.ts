import { MedusaService } from '@medusajs/framework/utils'
import { type AccountsOptions, type ResolvedAccountsOptions, resolveOptions } from '../../options'

/**
 * Holds the resolved plugin options. Medusa hands a module its `options` as the second constructor
 * argument (a plugin's modules get the plugin's `options` from `medusa-config.ts`) but passes
 * nothing to subscribers, workflow steps or routes – those read them through {@link getOptions}.
 * The module has no data models and no migrations: nothing is added to the shop's database.
 */
class AccountsModuleService extends MedusaService({}) {
  protected readonly options_: ResolvedAccountsOptions

  // biome-ignore lint/suspicious/noExplicitAny: the container type of MedusaService
  constructor(_container: Record<string, any>, options?: AccountsOptions) {
    // biome-ignore lint/complexity/noArguments: MedusaService takes every constructor argument
    super(...arguments)
    this.options_ = resolveOptions(options as AccountsOptions)
  }

  /** The plugin options with the defaults filled in and the texts merged. */
  getOptions(): ResolvedAccountsOptions {
    return this.options_
  }
}

export default AccountsModuleService

import type { MedusaContainer } from '@medusajs/framework/types'
import { ACCOUNTS_MODULE } from '../modules/accounts'
import type AccountsModuleService from '../modules/accounts/service'
import type { ResolvedAccountsOptions } from '../options'

/** The plugin options as the `accounts` module got them from `medusa-config.ts`. */
export function accountsOptions(scope: Pick<MedusaContainer, 'resolve'>): ResolvedAccountsOptions {
  let service: AccountsModuleService
  try {
    service = scope.resolve<AccountsModuleService>(ACCOUNTS_MODULE)
  } catch {
    throw new Error(
      'medusa-accounts: the `accounts` module is not registered – add the plugin to `plugins` in medusa-config (do not list the module in `modules` yourself).',
    )
  }
  return service.getOptions()
}

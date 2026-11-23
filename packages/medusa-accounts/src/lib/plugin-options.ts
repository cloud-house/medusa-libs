import type { MedusaContainer } from '@medusajs/framework/types'
import { ACCOUNTS_MODULE } from '../modules/accounts'
import type AccountsModuleService from '../modules/accounts/service'
import type { ResolvedAccountsOptions } from '../options'

/** The plugin options as the `accounts` module got them from `medusa-config.ts`. */
export const accountsOptions = (scope: Pick<MedusaContainer, 'resolve'>): ResolvedAccountsOptions =>
  scope.resolve<AccountsModuleService>(ACCOUNTS_MODULE).getOptions()

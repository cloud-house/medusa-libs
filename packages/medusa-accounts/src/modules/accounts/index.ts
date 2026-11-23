import { Module } from '@medusajs/framework/utils'
import AccountsModuleService from './service'

export const ACCOUNTS_MODULE = 'accounts'

export default Module(ACCOUNTS_MODULE, { service: AccountsModuleService })

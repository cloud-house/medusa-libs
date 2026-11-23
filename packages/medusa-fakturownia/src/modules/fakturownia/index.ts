import { Module } from '@medusajs/framework/utils'
import FakturowniaModuleService from './service'

export const FAKTUROWNIA_MODULE = 'fakturownia'

export default Module(FAKTUROWNIA_MODULE, { service: FakturowniaModuleService })

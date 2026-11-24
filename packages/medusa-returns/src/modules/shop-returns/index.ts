import { Module } from '@medusajs/framework/utils'
import ShopReturnsModuleService from './service'

export const RETURNS_MODULE = 'shopReturns'

export default Module(RETURNS_MODULE, { service: ShopReturnsModuleService })

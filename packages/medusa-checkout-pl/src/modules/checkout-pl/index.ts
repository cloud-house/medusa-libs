import { Module } from '@medusajs/framework/utils'
import CheckoutPlModuleService from './service'

export const CHECKOUT_PL_MODULE = 'checkoutPl'

export default Module(CHECKOUT_PL_MODULE, { service: CheckoutPlModuleService })

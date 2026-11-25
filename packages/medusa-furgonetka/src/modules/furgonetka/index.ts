import { Module } from '@medusajs/framework/utils'
import FurgonetkaModuleService from './service'

export const FURGONETKA_MODULE = 'furgonetka'

export default Module(FURGONETKA_MODULE, { service: FurgonetkaModuleService })

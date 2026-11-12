import { MedusaService } from '@medusajs/framework/utils'
import { type BrandsOptions, type ResolvedBrandsOptions, resolveOptions } from '../../options'
import { Brand } from './models/brand'

class BrandModuleService extends MedusaService({ Brand }) {
  protected readonly options_: ResolvedBrandsOptions

  /**
   * Medusa hands a module its `options` as the second argument; a plugin's modules get the
   * plugin's `options` from `medusa-config.ts`. Routes, workflows and the admin page read them
   * through {@link getOptions}.
   */
  // biome-ignore lint/suspicious/noExplicitAny: the container type of MedusaService
  constructor(_container: Record<string, any>, options?: BrandsOptions) {
    // biome-ignore lint/complexity/noArguments: MedusaService takes every constructor argument
    super(...arguments)
    this.options_ = resolveOptions(options)
  }

  /** The plugin options with the defaults filled in and the texts merged. */
  getOptions(): ResolvedBrandsOptions {
    return this.options_
  }
}

export default BrandModuleService

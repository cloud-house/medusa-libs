import { type ResolvedReturnsOptions, type ReturnsOptions, resolveOptions } from '../../options'

/**
 * Holds the plugin options – returns have no tables of their own (they are Medusa's returns).
 * Medusa hands a module its `options` as the second constructor argument (a plugin's modules get
 * the plugin's `options` from `medusa-config.ts`) but passes nothing to subscribers, workflows or
 * routes – those read them through {@link ShopReturnsModuleService.getOptions}.
 */
class ShopReturnsModuleService {
  protected readonly options_: ResolvedReturnsOptions

  // biome-ignore lint/suspicious/noExplicitAny: the container Medusa passes to every module service
  constructor(_container: Record<string, any>, options?: ReturnsOptions) {
    this.options_ = resolveOptions(options as ReturnsOptions)
  }

  /** The plugin options with the defaults filled in. */
  getOptions(): ResolvedReturnsOptions {
    return this.options_
  }
}

export default ShopReturnsModuleService

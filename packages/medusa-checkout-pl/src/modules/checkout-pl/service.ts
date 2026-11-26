import {
  type CheckoutPlOptions,
  type ResolvedCheckoutPlOptions,
  resolveOptions,
} from '../../options'

/**
 * Holds the plugin options – checkout has no tables of its own. Medusa hands a module its
 * `options` as the second constructor argument but passes nothing to subscribers, workflows or
 * routes – those read them through {@link CheckoutPlModuleService.getOptions}.
 */
class CheckoutPlModuleService {
  protected readonly options_: ResolvedCheckoutPlOptions

  // biome-ignore lint/suspicious/noExplicitAny: the container Medusa passes to every module service
  constructor(_container: Record<string, any>, options?: CheckoutPlOptions) {
    this.options_ = resolveOptions(options as CheckoutPlOptions)
  }

  /** The plugin options with the defaults filled in. */
  getOptions(): ResolvedCheckoutPlOptions {
    return this.options_
  }
}

export default CheckoutPlModuleService

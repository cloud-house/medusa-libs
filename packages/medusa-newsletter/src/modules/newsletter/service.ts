import { MedusaService } from '@medusajs/framework/utils'
import {
  type NewsletterOptions,
  type ResolvedNewsletterOptions,
  resolveOptions,
} from '../../options'
import { NewsletterSubscriber } from './models/newsletter-subscriber'

class NewsletterModuleService extends MedusaService({ NewsletterSubscriber }) {
  protected readonly options_: ResolvedNewsletterOptions

  /**
   * Medusa hands a module its `options` as the second argument; a plugin's modules get the
   * plugin's `options` from `medusa-config.ts`. Routes, the guard and the admin page read them
   * through {@link getOptions}.
   */
  // biome-ignore lint/suspicious/noExplicitAny: the container type of MedusaService
  constructor(_container: Record<string, any>, options?: NewsletterOptions) {
    // biome-ignore lint/complexity/noArguments: MedusaService takes every constructor argument
    super(...arguments)
    this.options_ = resolveOptions(options)
  }

  /** The plugin options with the defaults filled in and the texts merged. */
  getOptions(): ResolvedNewsletterOptions {
    return this.options_
  }
}

export default NewsletterModuleService

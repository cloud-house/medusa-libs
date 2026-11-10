import type { MedusaContainer } from '@medusajs/framework/types'
import { NEWSLETTER_MODULE } from '../modules/newsletter'
import type NewsletterModuleService from '../modules/newsletter/service'
import type { ResolvedNewsletterOptions } from '../options'

/** The plugin options as the newsletter module got them from `medusa-config.ts`. */
export const newsletterOptions = (scope: MedusaContainer): ResolvedNewsletterOptions =>
  scope.resolve<NewsletterModuleService>(NEWSLETTER_MODULE).getOptions()

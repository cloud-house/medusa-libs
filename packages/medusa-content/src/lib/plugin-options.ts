import type { MedusaContainer } from '@medusajs/framework/types'
import { CONTENT_MODULE } from '../modules/content'
import type ContentModuleService from '../modules/content/service'
import type { ResolvedContentOptions } from '../options'

/** The plugin options as the `content` module got them from `medusa-config.ts`. */
export function contentOptions(scope: Pick<MedusaContainer, 'resolve'>): ResolvedContentOptions {
  let service: ContentModuleService
  try {
    service = scope.resolve<ContentModuleService>(CONTENT_MODULE)
  } catch {
    throw new Error(
      `medusa-content: the \`${CONTENT_MODULE}\` module is not registered – add the plugin to \`plugins\` in medusa-config (do not list the module in \`modules\` yourself).`,
    )
  }
  return service.getOptions()
}

/** The prefix of the log lines (`logPrefix` option). */
export const logPrefix = (scope: Pick<MedusaContainer, 'resolve'>): string =>
  contentOptions(scope).logPrefix

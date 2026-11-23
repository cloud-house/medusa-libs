import { MedusaError } from '@medusajs/framework/utils'
import { EMAIL_ERROR_CODES } from './errors'
import type { ResolvedEmailsOptions } from './options'
import type { RenderedEmail } from './types'

/** Renders the template called `template` (from `options.templates`) with the shop's theme and texts. */
export async function renderEmail(
  options: ResolvedEmailsOptions,
  template: string,
  data: Record<string, unknown>,
): Promise<RenderedEmail> {
  const found = options.templates.find((candidate) => candidate.name === template)
  if (!found) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Unknown e-mail template: ${template}`,
      EMAIL_ERROR_CODES.unknownTemplate,
    )
  }
  return found.render(data, {
    theme: options.theme,
    messages: options.messages,
    locale: options.locale,
  })
}

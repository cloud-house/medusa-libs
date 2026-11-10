import {
  type MedusaNextFunction,
  type MedusaRequest,
  type MedusaResponse,
  validateAndTransformBody,
} from '@medusajs/framework/http'
import { z } from '@medusajs/framework/zod'
import { newsletterOptions } from '../../../lib/plugin-options'
import { NEWSLETTER_SOURCES, type NewsletterSource } from '../../../options'

export const StoreNewsletterSubscribe = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  consent_text: z.string().trim().min(1).max(2000),
  consent_at: z.iso.datetime({ offset: true }),
  source: z.enum(NEWSLETTER_SOURCES),
})
export type StoreNewsletterSubscribeType = z.infer<typeof StoreNewsletterSubscribe>

/** The body schema with `source` limited to the plugin option `sources`. */
const schemas = new WeakMap<readonly NewsletterSource[], typeof StoreNewsletterSubscribe>()
export function storeNewsletterSubscribeFor(sources: readonly NewsletterSource[]) {
  let schema = schemas.get(sources)
  if (!schema) {
    schema = StoreNewsletterSubscribe.extend({
      source: z.enum(NEWSLETTER_SOURCES).refine((source) => sources.includes(source)),
    })
    schemas.set(sources, schema)
  }
  return schema
}

/** `validateAndTransformBody` with the schema of the options (they are only known per request). */
export function validateSubscribe(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  return validateAndTransformBody(
    storeNewsletterSubscribeFor(newsletterOptions(req.scope).sources),
  )(req, res, next)
}
